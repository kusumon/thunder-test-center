import { describe, expect, it } from "vitest";
import { generateCertificateNumber, normalizeCertificateNumber } from "@/lib/certificateNumber";

const issued = new Date("2026-11-28T10:00:00Z");

describe("nomor sertifikat acak (tidak bisa ditebak/dienumerasi)", () => {
  it("format PREFIX-TAHUN-XXXX-XXXX tanpa karakter membingungkan", () => {
    for (let i = 0; i < 500; i++) {
      expect(generateCertificateNumber("TOEFLP", issued)).toMatch(/^TOEFLP-2026-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
    }
  });

  it("bukan lagi angka urut: 10.000 nomor semuanya unik", () => {
    const set = new Set(Array.from({ length: 10_000 }, () => generateCertificateNumber("TOEFLP", issued)));
    expect(set.size).toBe(10_000);
  });

  it("nomor berikutnya tidak bisa ditebak dari nomor sebelumnya", () => {
    const a = generateCertificateNumber("TOEFLP", issued);
    const b = generateCertificateNumber("TOEFLP", issued);
    expect(a).not.toBe(b);
    expect(a.slice(12)).not.toMatch(/^\d+$/);
  });

  it("sebaran karakter merata (acak kriptografis, bukan pola)", () => {
    const counts: Record<string, number> = {};
    for (let i = 0; i < 4000; i++) {
      for (const ch of generateCertificateNumber("X", issued).slice(7).replace("-", "")) counts[ch] = (counts[ch] ?? 0) + 1;
    }
    const values = Object.values(counts);
    expect(values.length).toBe(32);
    const expected = (4000 * 8) / 32;
    for (const v of values) expect(Math.abs(v - expected) / expected).toBeLessThan(0.2);
  });

  it("prefix dirapikan (tidak bisa menyisipkan karakter aneh)", () => {
    expect(generateCertificateNumber("toefl p/../", issued)).toMatch(/^TOEFLP-2026-/);
    expect(generateCertificateNumber("", issued)).toMatch(/^CERT-2026-/);
  });
});

describe("nomor yang diketik/dipindai untuk verifikasi", () => {
  it("huruf kecil & spasi dirapikan; nomor lama tetap cocok", () => {
    expect(normalizeCertificateNumber("  toeflp-2026-7kq4-m9xp ")).toBe("TOEFLP-2026-7KQ4-M9XP");
    expect(normalizeCertificateNumber("TOEFLP-2026-000008")).toBe("TOEFLP-2026-000008");
  });

  it("karakter % tidak membuat error; input panjang dipotong", () => {
    expect(() => normalizeCertificateNumber("%E0%A4%A")).not.toThrow();
    expect(normalizeCertificateNumber("A".repeat(5000)).length).toBe(64);
  });
});
