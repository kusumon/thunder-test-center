import { describe, expect, it } from "vitest";
import { seededShuffle } from "@/lib/shuffle";
import { generatePublicAttemptCode } from "@/lib/publicCode";

describe("seededShuffle — pengacakan pilihan jawaban", () => {
  const choices = ["A", "B", "C", "D"];

  it("seed sama → urutan selalu sama (stabil saat refresh)", () => {
    const a = seededShuffle(choices, "attempt-1:q1");
    for (let i = 0; i < 20; i++) expect(seededShuffle(choices, "attempt-1:q1")).toEqual(a);
  });

  it("hasilnya permutasi lengkap: tidak ada pilihan hilang/ganda", () => {
    for (let i = 0; i < 200; i++) {
      expect([...seededShuffle(choices, `seed-${i}`)].sort()).toEqual(choices);
    }
  });

  it("tidak mengubah array asli", () => {
    const original = [...choices];
    seededShuffle(choices, "x");
    expect(choices).toEqual(original);
  });

  it("attempt berbeda → urutan bervariasi (tidak bisa dihafal)", () => {
    const orders = new Set<string>();
    for (let i = 0; i < 200; i++) orders.add(seededShuffle(choices, `attempt-${i}:q1`).join(""));
    // 24 permutasi mungkin; 200 seed seharusnya menghasilkan hampir semuanya.
    expect(orders.size).toBeGreaterThanOrEqual(20);
  });

  it("sebaran posisi kunci jawaban kira-kira merata (tidak bias ke satu posisi)", () => {
    const positionCount = [0, 0, 0, 0];
    const N = 4000;
    for (let i = 0; i < N; i++) positionCount[seededShuffle(choices, `a${i}:q`).indexOf("A")]++;
    for (const c of positionCount) {
      expect(c / N).toBeGreaterThan(0.2);
      expect(c / N).toBeLessThan(0.3);
    }
  });

  it("menangani array kosong & satu elemen", () => {
    expect(seededShuffle([], "x")).toEqual([]);
    expect(seededShuffle(["A"], "x")).toEqual(["A"]);
  });
});

describe("kode attempt publik", () => {
  it("format TP-YY-XXXXXX dengan tahun dari tanggal", () => {
    const code = generatePublicAttemptCode(new Date("2026-03-01T00:00:00Z"));
    expect(code).toMatch(/^TP-26-[A-Z2-9]{6}$/);
  });

  it("tidak memakai karakter yang membingungkan (0, O, 1, I)", () => {
    for (let i = 0; i < 500; i++) {
      expect(generatePublicAttemptCode().slice(6)).not.toMatch(/[01OI]/);
    }
  });

  it("praktis unik: 5.000 kode tanpa duplikat", () => {
    const codes = new Set(Array.from({ length: 5000 }, () => generatePublicAttemptCode()));
    expect(codes.size).toBe(5000);
  });
});
