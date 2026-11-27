import { describe, expect, it } from "vitest";
import { buildConversionTable, countCorrect, overallPredictionScore, toScaledScore } from "@/lib/scoring";
import { cefrLevel, MAX_TOTAL_SCORE } from "@/lib/scoreLevel";

describe("tabel konversi", () => {
  const table = buildConversionTable([
    { rawScore: 0, scaledScore: 24 },
    { rawScore: 1, scaledScore: 25 },
    { rawScore: 50, scaledScore: 68 },
  ]);

  it("mengonversi raw score yang ada di tabel", () => {
    expect(toScaledScore(0, table)).toBe(24);
    expect(toScaledScore(50, table)).toBe(68);
  });

  it("menolak raw score yang tidak ada (tidak menebak/interpolasi)", () => {
    expect(() => toScaledScore(25, table)).toThrow(/tidak memuat raw score 25/);
    expect(() => toScaledScore(-1, table)).toThrow();
  });

  it("baris duplikat: nilai terakhir yang dipakai", () => {
    const t = buildConversionTable([
      { rawScore: 1, scaledScore: 30 },
      { rawScore: 1, scaledScore: 31 },
    ]);
    expect(toScaledScore(1, t)).toBe(31);
  });
});

describe("skor keseluruhan ROUND((L+S+R)*10/3)", () => {
  it.each([
    [68, 68, 67, 677], // skor maksimum
    [24, 20, 21, 217], // skor minimum tabel bawaan
    [51, 50, 53, 513],
    [37, 37, 28, 340], // data nyata "Mon"
    [50, 50, 51, 503], // 503,33 → dibulatkan ke bawah
    [50, 51, 51, 507], // 506,67 → dibulatkan ke atas
  ])("(%i, %i, %i) → %i", (l, s, r, expected) => {
    expect(overallPredictionScore(l, s, r)).toBe(expected);
  });

  it("maksimum sama dengan MAX_TOTAL_SCORE", () => {
    expect(overallPredictionScore(68, 68, 67)).toBe(MAX_TOTAL_SCORE);
  });
});

describe("hitung jawaban benar", () => {
  const key = new Map([
    ["q1", "A"],
    ["q2", "B"],
    ["q3", "C"],
  ]);

  it("hanya menghitung yang cocok dengan kunci", () => {
    expect(countCorrect(key, new Map([["q1", "A"], ["q2", "C"]]))).toBe(1);
  });

  it("soal tidak dijawab = salah, tidak ada penalti", () => {
    expect(countCorrect(key, new Map())).toBe(0);
  });

  it("jawaban untuk soal di luar kunci diabaikan (tidak bisa menaikkan skor)", () => {
    const forged = new Map([
      ["q1", "A"],
      ["soal-palsu-1", "A"],
      ["soal-palsu-2", "B"],
    ]);
    expect(countCorrect(key, forged)).toBe(1);
  });

  it("huruf kecil tidak dianggap benar (kunci case-sensitive)", () => {
    expect(countCorrect(key, new Map([["q1", "a"]]))).toBe(0);
  });
});

describe("level CEFR — batas tepat", () => {
  it.each([
    [216, "A1"],
    [336, "A1"],
    [337, "A2"],
    [459, "A2"],
    [460, "B1"],
    [542, "B1"],
    [543, "B2"],
    [626, "B2"],
    [627, "C1"],
    [677, "C1"],
  ])("skor %i → %s", (score, code) => {
    expect(cefrLevel(score).code).toBe(code);
  });

  it("setiap level punya label Indonesia & Inggris", () => {
    for (const s of [300, 400, 500, 600, 650]) {
      const l = cefrLevel(s);
      expect(l.labelId.length).toBeGreaterThan(0);
      expect(l.labelEn.length).toBeGreaterThan(0);
    }
  });
});
