/**
 * Logika penilaian — SRS §6.
 *
 * Semua fungsi di file ini murni (tanpa akses database) supaya bisa diuji
 * sendiri. Pemanggilan database dilakukan di layer service, dan penilaian
 * HANYA berjalan di server memakai kunci jawaban dari database
 * (NFR-SEC-010: skor tidak boleh dipercaya dari kiriman browser).
 */

export type SectionTypeKey = "LISTENING" | "STRUCTURE" | "READING";

/** Peta raw score -> scaled score untuk satu section. */
export type ConversionTable = ReadonlyMap<number, number>;

export function buildConversionTable(
  rules: ReadonlyArray<{ rawScore: number; scaledScore: number }>,
): ConversionTable {
  return new Map(rules.map((rule) => [rule.rawScore, rule.scaledScore]));
}

/**
 * Ubah raw score jadi scaled score lewat tabel konversi.
 *
 * Tabel wajib memuat setiap kemungkinan raw score. Kalau ada yang bolong kita
 * melempar error alih-alih menebak dengan interpolasi — SRS §6.2 melarang
 * konversi yang tidak terverifikasi, dan skor salah jauh lebih berbahaya
 * daripada permintaan yang gagal.
 */
export function toScaledScore(rawScore: number, table: ConversionTable): number {
  const scaled = table.get(rawScore);
  if (scaled === undefined) {
    throw new Error(
      `Tabel konversi tidak memuat raw score ${rawScore}. Lengkapi tabel di dashboard admin.`,
    );
  }
  return scaled;
}

/**
 * Skor prediksi keseluruhan — SRS §6.3.
 *
 *   ROUND((listening + structure + reading) * 10 / 3)
 *
 * Contoh: (68 + 68 + 67) * 10 / 3 = 676,67 -> 677
 */
export function overallPredictionScore(
  listeningScaled: number,
  structureScaled: number,
  readingScaled: number,
): number {
  return Math.round(((listeningScaled + structureScaled + readingScaled) * 10) / 3);
}

/**
 * Hitung jumlah jawaban benar untuk satu section.
 *
 * Soal yang tidak dijawab dihitung salah (tidak ada penalti khusus), dan
 * jawaban untuk soal di luar `answerKey` diabaikan supaya kiriman jawaban
 * yang tidak dikenal tidak bisa menaikkan skor.
 */
export function countCorrect(
  answerKey: ReadonlyMap<string, string>,
  submitted: ReadonlyMap<string, string>,
): number {
  let correct = 0;
  for (const [questionId, correctKey] of answerKey) {
    if (submitted.get(questionId) === correctKey) correct += 1;
  }
  return correct;
}
