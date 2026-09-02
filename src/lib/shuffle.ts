/**
 * Pengacakan deterministik — SRS §19 ("Choice order may be randomized...").
 *
 * Urutan pilihan jawaban diacak per (attempt, soal), tapi harus STABIL
 * selama attempt itu berlangsung: kalau urutannya berubah setiap refresh,
 * jawaban yang sudah dipilih peserta bisa terlihat "pindah" ke pilihan
 * lain. Solusinya: seed dari hash `${attemptId}:${questionId}` sehingga
 * hasil acaknya selalu sama untuk pasangan itu, tapi beda antar-attempt
 * (jadi tidak bisa dihafal "jawabannya selalu di posisi ke-3").
 */

/** FNV-1a 32-bit — cukup untuk seed, bukan untuk keamanan. */
function hashSeed(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** mulberry32: PRNG kecil, deterministik dari satu seed 32-bit. */
function mulberry32(seed: number) {
  let state = seed;
  return function next() {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher-Yates dengan PRNG yang di-seed dari `seedInput` — hasilnya stabil untuk seed yang sama. */
export function seededShuffle<T>(items: readonly T[], seedInput: string): T[] {
  const rng = mulberry32(hashSeed(seedInput));
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
