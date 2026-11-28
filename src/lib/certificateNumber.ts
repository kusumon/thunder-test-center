import { randomInt } from "node:crypto";

/**
 * Nomor sertifikat ACAK, mis. `TOEFLP-2026-7KQ4-M9XP`.
 *
 * Dulu nomornya berurutan (TOEFLP-2026-000001, 000002, …), sehingga siapa
 * pun bisa mencoba nomor-nomor itu di halaman verifikasi publik dan melihat
 * nama + skor semua pemegang sertifikat (temuan pentest). Sekarang 8
 * karakter acak dari 32 simbol = 32^8 ≈ 1,1 triliun kemungkinan — tidak
 * praktis ditebak. Sertifikat lama tetap memakai nomor lamanya supaya QR
 * yang sudah tercetak tetap bisa diverifikasi.
 *
 * Alfabet tanpa 0/O/1/I supaya tidak salah dibaca saat diketik ulang.
 */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function segment(length: number): string {
  let out = "";
  for (let i = 0; i < length; i += 1) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}

export function generateCertificateNumber(prefix: string, issuedAt: Date): string {
  const safePrefix = prefix.toUpperCase().replace(/[^A-Z0-9]/g, "") || "CERT";
  return `${safePrefix}-${issuedAt.getUTCFullYear()}-${segment(4)}-${segment(4)}`;
}

/** Nomor yang diketik/dipindai: rapikan spasi & huruf kecil. Panjang dibatasi. */
export function normalizeCertificateNumber(raw: string): string {
  // Parameter rute sudah di-decode Next.js — jangan decode lagi (karakter
  // "%" literal akan membuat decodeURIComponent melempar error).
  return String(raw ?? "").trim().toUpperCase().slice(0, 64);
}
