import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  existing: null as Record<string, unknown> | null,
  createCalls: [] as string[],
  failNext: [] as ("number" | "attempt")[],
  raced: null as Record<string, unknown> | null,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    certificate: {
      findUnique: vi.fn(async () => (db.createCalls.length > 0 ? db.raced : db.existing)),
      create: vi.fn(async ({ data }: { data: { certificateNumber: string } }) => {
        db.createCalls.push(data.certificateNumber);
        const fail = db.failNext.shift();
        if (fail) throw Object.assign(new Error("Unique constraint"), { code: "P2002" });
        return { id: "cert-1", ...data };
      }),
    },
    attempt: {
      findUniqueOrThrow: vi.fn(async () => ({
        id: "att-1",
        status: "COMPLETED",
        overallScore: 500,
        testPackage: { certificateMinScore: null },
      })),
    },
  },
}));

const { getOrCreateCertificate } = await import("@/lib/certificate");

beforeEach(() => {
  db.existing = null;
  db.createCalls = [];
  db.failNext = [];
  db.raced = null;
});

describe("penerbitan sertifikat", () => {
  it("sertifikat baru memakai nomor ACAK, bukan angka urut", async () => {
    const cert = (await getOrCreateCertificate("att-1")) as { certificateNumber: string };
    expect(cert.certificateNumber).toMatch(/^TOEFLP-\d{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect(cert.certificateNumber).not.toMatch(/-\d{6}$/);
  });

  it("idempoten: attempt yang sudah punya sertifikat tidak dibuatkan nomor baru", async () => {
    db.existing = { id: "lama", certificateNumber: "TOEFLP-2026-000008" };
    const cert = (await getOrCreateCertificate("att-1")) as { certificateNumber: string };
    expect(cert.certificateNumber).toBe("TOEFLP-2026-000008");
    expect(db.createCalls).toHaveLength(0);
  });

  it("nomor kebetulan bentrok → otomatis dicoba dengan nomor lain", async () => {
    db.failNext = ["number", "number"];
    const cert = (await getOrCreateCertificate("att-1")) as { certificateNumber: string };
    expect(db.createCalls).toHaveLength(3);
    expect(new Set(db.createCalls).size).toBe(3);
    expect(cert.certificateNumber).toBe(db.createCalls[2]);
  });

  it("dua persetujuan bersamaan → tidak ada sertifikat ganda", async () => {
    db.failNext = ["attempt"];
    db.raced = { id: "cert-dari-request-lain", certificateNumber: "TOEFLP-2026-ABCD-EFGH" };
    const cert = (await getOrCreateCertificate("att-1")) as { id: string };
    expect(cert.id).toBe("cert-dari-request-lain");
    expect(db.createCalls).toHaveLength(1);
  });
});
