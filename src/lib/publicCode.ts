import { randomInt } from "node:crypto";

/**
 * Kode attempt publik, format `TP-26-A7K92M` (SRS FR-002).
 *
 * Dipakai di URL dan ditampilkan ke peserta, sehingga sengaja tidak
 * memakai UUID mentah (§ "tanpa mengekspos ID database internal").
 * Karakter yang membingungkan (0/O, 1/I) dibuang dari alfabet.
 */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomSegment(length: number): string {
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += ALPHABET[randomInt(ALPHABET.length)];
  }
  return out;
}

export function generatePublicAttemptCode(now = new Date()): string {
  const yy = String(now.getUTCFullYear() % 100).padStart(2, "0");
  return `TP-${yy}-${randomSegment(6)}`;
}
