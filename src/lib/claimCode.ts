/**
 * Normalisasi kode klaim yang diketik ulang peserta — toleran terhadap
 * huruf kecil, spasi, tanpa tanda hubung, atau tanpa awalan "TPC".
 * Mengembalikan format baku `TPC-XXXX-XXXX`, atau `null` kalau kosong.
 * Fungsi murni (tanpa database) supaya bisa diuji sendiri.
 */
export function normalizeClaimCode(raw: unknown): string | null {
  let compact = String(raw ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  if (!compact) return null;
  // Batasi panjang: input sangat panjang tidak mungkin kode yang sah.
  if (compact.length > 32) compact = compact.slice(0, 32);
  if (compact.length === 8) compact = `TPC${compact}`;
  return compact.length === 11 && compact.startsWith("TPC")
    ? `TPC-${compact.slice(3, 7)}-${compact.slice(7)}`
    : compact;
}
