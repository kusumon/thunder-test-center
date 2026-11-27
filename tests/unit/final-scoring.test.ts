import { beforeEach, describe, expect, it, vi } from "vitest";

/* Database tiruan secukupnya untuk submitAttempt(). */
type Session = { id: string; sectionId: string; submittedAt: Date | null; endsAt: Date };
const db = vi.hoisted(() => ({
  attempt: null as Record<string, unknown> | null,
  questions: [] as { id: string; sectionId: string; section: { type: string }; correctChoiceKey: string }[],
  answers: [] as { questionId: string; selectedChoiceKey: string }[],
  sessionUpdates: [] as { id: string; submittedAt: Date }[],
  attemptUpdate: null as Record<string, unknown> | null,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    attempt: {
      findUniqueOrThrow: vi.fn(async () => db.attempt),
      update: vi.fn((args: { data: Record<string, unknown> }) => {
        db.attemptUpdate = args.data;
        return Promise.resolve(args);
      }),
    },
    question: { findMany: vi.fn(async () => db.questions) },
    attemptAnswer: { findMany: vi.fn(async () => db.answers) },
    attemptSectionSession: {
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: { submittedAt: Date } }) => {
        db.sessionUpdates.push({ id: where.id, submittedAt: data.submittedAt });
      }),
    },
    $executeRaw: vi.fn(() => Promise.resolve(0)),
    $transaction: vi.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
  },
}));

const { submitAttempt } = await import("@/lib/results");

// Tabel konversi sederhana: scaled = 20 + raw (raw 0..3).
const rules = ["LISTENING", "STRUCTURE", "READING"].flatMap((t) =>
  [0, 1, 2, 3].map((raw) => ({ sectionType: t, rawScore: raw, scaledScore: 20 + raw })),
);
const sections = [
  { id: "s-l", type: "LISTENING" },
  { id: "s-s", type: "STRUCTURE" },
  { id: "s-r", type: "READING" },
];
const past = new Date(Date.now() - 60_000);
const future = new Date(Date.now() + 3_600_000);

function setup(sessions: Session[], status = "IN_PROGRESS") {
  db.attempt = {
    id: "att-1",
    status,
    testPackageId: "pkg",
    testPackage: { sections, conversionRules: rules },
    sectionSessions: sessions,
  };
}

beforeEach(() => {
  db.sessionUpdates = [];
  db.attemptUpdate = null;
  db.questions = sections.flatMap((s) =>
    [1, 2, 3].map((n) => ({ id: `${s.id}-q${n}`, sectionId: s.id, section: { type: s.type }, correctChoiceKey: "A" })),
  );
  db.answers = [];
});

const allSubmitted = (): Session[] =>
  sections.map((s) => ({ id: `ss-${s.id}`, sectionId: s.id, submittedAt: new Date(), endsAt: future }));

describe("kirim jawaban akhir & penilaian", () => {
  it("menghitung skor hanya dari kunci jawaban di database", async () => {
    setup(allSubmitted());
    db.answers = [
      { questionId: "s-l-q1", selectedChoiceKey: "A" },
      { questionId: "s-l-q2", selectedChoiceKey: "A" },
      { questionId: "s-s-q1", selectedChoiceKey: "B" }, // salah
      { questionId: "s-r-q1", selectedChoiceKey: "A" },
    ];
    await submitAttempt("att-1");
    expect(db.attemptUpdate).toMatchObject({
      status: "COMPLETED",
      listeningRaw: 2,
      structureRaw: 0,
      readingRaw: 1,
      listeningScaled: 22,
      structureScaled: 20,
      readingScaled: 21,
      overallScore: 210, // (22+20+21)*10/3
    });
  });

  it("jawaban untuk soal yang tidak ada di paket tidak menaikkan skor", async () => {
    setup(allSubmitted());
    db.answers = [
      { questionId: "soal-palsu", selectedChoiceKey: "A" },
      { questionId: "s-l-q1", selectedChoiceKey: "A" },
    ];
    await submitAttempt("att-1");
    expect(db.attemptUpdate).toMatchObject({ listeningRaw: 1, structureRaw: 0, readingRaw: 0 });
  });

  it("bagian yang masih berjalan → ditolak (tidak bisa kirim lebih awal)", async () => {
    setup([
      { id: "a", sectionId: "s-l", submittedAt: new Date(), endsAt: future },
      { id: "b", sectionId: "s-s", submittedAt: new Date(), endsAt: future },
      { id: "c", sectionId: "s-r", submittedAt: null, endsAt: future },
    ]);
    await expect(submitAttempt("att-1")).rejects.toThrow(/masih berjalan/);
    expect(db.attemptUpdate).toBeNull();
  });

  it("bagian yang belum pernah dimulai → ditolak", async () => {
    setup([{ id: "a", sectionId: "s-l", submittedAt: new Date(), endsAt: future }]);
    await expect(submitAttempt("att-1")).rejects.toThrow(/belum dimulai/);
  });

  it("REGRESI: waktu habis saat tab tertutup → tetap bisa kirim & dapat skor", async () => {
    setup([
      { id: "a", sectionId: "s-l", submittedAt: null, endsAt: past },
      { id: "b", sectionId: "s-s", submittedAt: new Date(), endsAt: future },
      { id: "c", sectionId: "s-r", submittedAt: null, endsAt: past },
    ]);
    await submitAttempt("att-1");
    expect(db.attemptUpdate).toMatchObject({ status: "COMPLETED" });
    // Bagian yang habis waktu dicatat selesai TEPAT di batas waktunya.
    expect(db.sessionUpdates).toEqual([
      { id: "a", submittedAt: past },
      { id: "c", submittedAt: past },
    ]);
  });

  it("attempt yang sudah selesai tidak dinilai ulang (immutable)", async () => {
    setup(allSubmitted(), "COMPLETED");
    await submitAttempt("att-1");
    expect(db.attemptUpdate).toBeNull();
  });
});
