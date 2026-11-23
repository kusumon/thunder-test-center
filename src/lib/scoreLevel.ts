/**
 * Perkiraan level CEFR dari skor total, memakai batas yang lazim untuk
 * TOEFL ITP (627 / 543 / 460 / 337). Hanya gambaran untuk peserta — bukan
 * klaim resmi. Dipakai halaman hasil dan sertifikat PDF supaya selalu sama.
 */
export type ScoreLevel = { code: string; labelId: string; labelEn: string };

export function cefrLevel(score: number): ScoreLevel {
  if (score >= 627)
    return { code: "C1", labelId: "Mahir", labelEn: "Advanced" };
  if (score >= 543)
    return {
      code: "B2",
      labelId: "Menengah Atas",
      labelEn: "Upper Intermediate",
    };
  if (score >= 460)
    return { code: "B1", labelId: "Menengah", labelEn: "Intermediate" };
  if (score >= 337)
    return { code: "A2", labelId: "Dasar", labelEn: "Elementary" };
  return { code: "A1", labelId: "Pemula", labelEn: "Beginner" };
}

/** Skor total maksimum format TOEFL ITP: (68 + 68 + 67) × 10 / 3. */
export const MAX_TOTAL_SCORE = 677;

/** Skor maksimum per bagian (untuk panjang batang di sertifikat). */
export const MAX_SECTION_SCORE = {
  LISTENING: 68,
  STRUCTURE: 68,
  READING: 67,
} as const;
