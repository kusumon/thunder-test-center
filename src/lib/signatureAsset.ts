import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { downloadPrivateAsset } from "@/lib/audioStorage";

/**
 * Gambar tanda tangan penandatangan sertifikat (PNG transparan).
 *
 * SENGAJA tidak disimpan di repo: repositori GitHub proyek ini PUBLIK, dan
 * file tanda tangan bersih tanpa latar mudah disalahgunakan. Sumbernya:
 *   1. Supabase Storage privat: `branding/signature.png` (produksi).
 *   2. File lokal `private/signature.png` (folder di-.gitignore, untuk dev).
 * Kalau keduanya tidak ada, sertifikat tetap dibuat dengan garis tanda
 * tangan kosong.
 *
 * Hasil di-cache di memori 10 menit supaya tiap unduhan PDF tidak selalu
 * mengambil ulang dari Supabase.
 */
const STORAGE_PATH = "branding/signature.png";
const LOCAL_PATH = join(process.cwd(), "private", "signature.png");
const CACHE_MS = 10 * 60 * 1000;

let cache: { png: Buffer | null; at: number } | null = null;

export async function getSignatureImage(): Promise<Buffer | null> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.png;

  let png: Buffer | null = null;
  try {
    png = await downloadPrivateAsset(STORAGE_PATH);
  } catch {
    png = null; // Supabase sedang bermasalah — jangan gagalkan pembuatan PDF.
  }
  if (!png) {
    png = await readFile(LOCAL_PATH).catch(() => null);
  }

  cache = { png, at: Date.now() };
  return png;
}
