import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));

const { toPublicQuestion, assertSectionUnlocked, SectionAccessError } = await import("@/lib/sections");

const question = (type: "MCQ" | "ERROR_RECOGNITION") => ({
  id: "q-1",
  number: 1,
  questionType: type,
  stem: "Stem",
  correctChoiceKey: "C",
  choices: ["A", "B", "C", "D"].map((k) => ({ choiceKey: k, text: `teks ${k}`, id: `c${k}`, position: 0 })),
});

describe("soal yang dikirim ke browser (FR-021/FR-022)", () => {
  it("KUNCI JAWABAN tidak pernah ikut terkirim", () => {
    const pub = toPublicQuestion(question("MCQ"), "attempt-1");
    const json = JSON.stringify(pub);
    expect(json).not.toContain("correctChoiceKey");
    expect(Object.keys(pub).sort()).toEqual(["choices", "id", "number", "questionType", "stem"]);
    for (const c of pub.choices) expect(Object.keys(c).sort()).toEqual(["key", "text"]);
  });

  it("MCQ: urutan diacak per attempt, tapi isi pilihan tetap lengkap", () => {
    const orders = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const pub = toPublicQuestion(question("MCQ"), `attempt-${i}`);
      orders.add(pub.choices.map((c) => c.key).join(""));
      expect(pub.choices.map((c) => c.key).sort()).toEqual(["A", "B", "C", "D"]);
    }
    expect(orders.size).toBeGreaterThan(1);
  });

  it("MCQ: attempt yang sama → urutan yang sama (stabil saat refresh)", () => {
    const a = toPublicQuestion(question("MCQ"), "attempt-x").choices;
    const b = toPublicQuestion(question("MCQ"), "attempt-x").choices;
    expect(a).toEqual(b);
  });

  it("Error Recognition TIDAK diacak (A–D menunjuk urutan bagian kalimat)", () => {
    for (let i = 0; i < 20; i++) {
      expect(toPublicQuestion(question("ERROR_RECOGNITION"), `a-${i}`).choices.map((c) => c.key)).toEqual([
        "A",
        "B",
        "C",
        "D",
      ]);
    }
  });
});

describe("urutan bagian tes tidak bisa dilompati", () => {
  const sections = [
    { id: "s-l", type: "LISTENING" },
    { id: "s-s", type: "STRUCTURE" },
    { id: "s-r", type: "READING" },
  ];
  const attempt = (sessions: { sectionId: string; submittedAt: Date | null; endsAt: Date }[], status = "IN_PROGRESS") =>
    ({ status, testPackage: { sections }, sectionSessions: sessions }) as unknown as Parameters<
      typeof assertSectionUnlocked
    >[0];
  const future = new Date(Date.now() + 3_600_000);
  const past = new Date(Date.now() - 1000);

  it("Listening selalu boleh dimulai", () => {
    expect(() => assertSectionUnlocked(attempt([]), "LISTENING")).not.toThrow();
  });

  it("langsung ke Reading tanpa menyelesaikan Listening & Structure → ditolak", () => {
    expect(() => assertSectionUnlocked(attempt([]), "READING")).toThrow(SectionAccessError);
  });

  it("Structure ditolak selama Listening masih berjalan", () => {
    expect(() =>
      assertSectionUnlocked(attempt([{ sectionId: "s-l", submittedAt: null, endsAt: future }]), "STRUCTURE"),
    ).toThrow(SectionAccessError);
  });

  it("Structure boleh setelah Listening disubmit ATAU waktunya habis", () => {
    expect(() =>
      assertSectionUnlocked(attempt([{ sectionId: "s-l", submittedAt: new Date(), endsAt: future }]), "STRUCTURE"),
    ).not.toThrow();
    expect(() =>
      assertSectionUnlocked(attempt([{ sectionId: "s-l", submittedAt: null, endsAt: past }]), "STRUCTURE"),
    ).not.toThrow();
  });

  it("attempt yang sudah selesai tidak bisa memulai bagian apa pun", () => {
    expect(() => assertSectionUnlocked(attempt([], "COMPLETED"), "LISTENING")).toThrow(SectionAccessError);
  });
});
