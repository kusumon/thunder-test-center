import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Sumber audio Listening — FR-023.
 *
 * Dua mode, dipilih otomatis dari env var (bukan hardcode):
 * - Supabase Storage dikonfigurasi (SUPABASE_URL + SERVICE_ROLE_KEY): audio
 *   disajikan lewat signed URL berumur pendek dari bucket PRIVATE. Ini jalur
 *   produksi — Vercel tidak punya disk permanen, jadi file lokal di
 *   `content/` tidak bisa diandalkan setelah deploy.
 * - Tidak dikonfigurasi: file lokal di `content/<packageCode>/<audioAssetKey>`
 *   (AUDIO_LOCAL_FALLBACK, dipakai saat development).
 *
 * Kontrak route pemanggil (api/audio/[attemptCode]) tidak berubah antara
 * kedua mode — hanya cara audio DIAMBIL yang beda.
 */
export type AudioSource =
  | { type: "local"; filePath: string }
  | { type: "redirect"; url: string };

/**
 * Nama folder lokal / prefiks object storage SELALU slug dari kode paket
 * (huruf kecil, non-alfanumerik jadi "-") — konsisten dengan
 * scripts/parse-question-bank.mjs yang membuat folder ini. Kalau dua sisi
 * ini pernah tidak sinkron, audio Listening paket tersebut diam-diam gagal
 * dimuat (403/404), jadi jangan duplikasi logika ini di tempat lain.
 */
function slugifyPackageCode(code: string): string {
  return code.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function isSupabaseConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY);
}

function supabaseClient() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false },
  });
}

/**
 * `expiresInSeconds` idealnya sisa waktu section Listening peserta ini,
 * supaya tautan otomatis kedaluwarsa saat section berakhir — bukan umur
 * tetap yang bisa dipakai ulang setelah tes selesai.
 */
export async function getAudioSource(
  packageCode: string,
  audioAssetKey: string,
  expiresInSeconds: number,
): Promise<AudioSource> {
  const slug = slugifyPackageCode(packageCode);

  if (!isSupabaseConfigured()) {
    const { join } = await import("node:path");
    return { type: "local", filePath: join(process.cwd(), "content", slug, audioAssetKey) };
  }

  const bucket = process.env.SUPABASE_AUDIO_BUCKET || "toefl-audio";
  const objectPath = `${slug}/${audioAssetKey}`;
  const ttl = Math.max(30, Math.round(expiresInSeconds));

  const { data, error } = await supabaseClient()
    .storage.from(bucket)
    .createSignedUrl(objectPath, ttl);

  if (error || !data?.signedUrl) {
    throw new Error(`Gagal membuat signed URL untuk ${objectPath}: ${error?.message ?? "unknown error"}`);
  }
  return { type: "redirect", url: data.signedUrl };
}

/** Dipakai skrip unggah admin — lihat scripts/upload-audio.ts. */
export async function uploadAudioFile(packageCode: string, audioAssetKey: string, fileBuffer: Buffer) {
  if (!isSupabaseConfigured()) {
    throw new Error("SUPABASE_URL / SUPABASE_SECRET_KEY belum diisi di .env.");
  }
  const bucket = process.env.SUPABASE_AUDIO_BUCKET || "toefl-audio";
  const client = supabaseClient();

  const { data: buckets } = await client.storage.listBuckets();
  if (!buckets?.some((b) => b.name === bucket)) {
    const { error } = await client.storage.createBucket(bucket, { public: false });
    if (error) throw new Error(`Gagal membuat bucket "${bucket}": ${error.message}`);
  }

  const objectPath = `${slugifyPackageCode(packageCode)}/${audioAssetKey}`;
  const { error } = await client.storage
    .from(bucket)
    .upload(objectPath, fileBuffer, { contentType: "audio/mpeg", upsert: true });
  if (error) throw new Error(`Gagal unggah ${objectPath}: ${error.message}`);

  return objectPath;
}
