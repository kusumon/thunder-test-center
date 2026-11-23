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

export { isSupabaseConfigured };

/**
 * Jaga proyek Supabase gratis tetap "aktif".
 *
 * Supabase menjeda proyek Free Plan yang aktivitas databasenya terlalu
 * sedikit selama 7 hari. Data utama aplikasi ini ada di Neon — Supabase
 * hanya menyimpan audio Listening — jadi Supabase hanya "melihat" aktivitas
 * saat ada peserta memutar audio. Seminggu tanpa peserta = proyek dijeda =
 * audio Listening mati untuk peserta berikutnya (pernah terjadi).
 *
 * Dipanggil sekali sehari oleh Vercel Cron (vercel.json → /api/cron/keepalive).
 * Beberapa request sekaligus karena dokumentasi Supabase menyebut "a few
 * user requests to the database each day"; setiap request Storage API
 * menjalankan query ke skema storage di Postgres Supabase.
 */
export async function keepSupabaseAwake(): Promise<{ ok: boolean; detail: string }> {
  if (!isSupabaseConfigured()) return { ok: true, detail: "Supabase belum diatur — dilewati." };

  const bucket = process.env.SUPABASE_AUDIO_BUCKET || "toefl-audio";
  const client = supabaseClient();

  const steps: [string, () => Promise<{ error: { message: string } | null }>][] = [
    ["listBuckets", () => client.storage.listBuckets()],
    ["list root", () => client.storage.from(bucket).list("", { limit: 10 })],
    ["getBucket", () => client.storage.getBucket(bucket)],
  ];

  const failures: string[] = [];
  for (const [name, run] of steps) {
    try {
      const { error } = await run();
      if (error) failures.push(`${name}: ${error.message}`);
    } catch (error) {
      failures.push(`${name}: ${error instanceof Error ? error.message : "unknown error"}`);
    }
  }

  return failures.length === 0
    ? { ok: true, detail: `${steps.length} request ke Supabase berhasil.` }
    : { ok: false, detail: failures.join(" | ") };
}

/**
 * Tautan unggah sekali-pakai (berlaku 2 jam) supaya BROWSER admin mengirim
 * file MP3 langsung ke Supabase. Sebelumnya file dikirim lewat server
 * action, yang dibatasi 1 MB oleh Next.js (dan ~4,5 MB oleh Vercel) —
 * audio Listening asli puluhan MB sehingga unggahan selalu gagal.
 */
export async function createAudioUploadUrl(packageCode: string, audioAssetKey: string) {
  if (!isSupabaseConfigured()) {
    throw new Error("Penyimpanan audio (Supabase) belum diatur. Hubungi pengelola teknis.");
  }
  const bucket = process.env.SUPABASE_AUDIO_BUCKET || "toefl-audio";
  const client = supabaseClient();

  const { data: buckets } = await client.storage.listBuckets();
  if (!buckets?.some((b) => b.name === bucket)) {
    const { error } = await client.storage.createBucket(bucket, { public: false });
    if (error) throw new Error(`Gagal menyiapkan penyimpanan audio: ${error.message}`);
  }

  const objectPath = `${slugifyPackageCode(packageCode)}/${audioAssetKey}`;
  const { data, error } = await client.storage.from(bucket).createSignedUploadUrl(objectPath, { upsert: true });
  if (error || !data) throw new Error(`Gagal menyiapkan unggahan: ${error?.message ?? "unknown error"}`);
  return data.signedUrl;
}

/** Pastikan file benar-benar sudah ada di storage sebelum dipakai peserta. */
export async function audioFileExists(packageCode: string, audioAssetKey: string): Promise<boolean> {
  const bucket = process.env.SUPABASE_AUDIO_BUCKET || "toefl-audio";
  const { data } = await supabaseClient()
    .storage.from(bucket)
    .list(slugifyPackageCode(packageCode), { search: audioAssetKey });
  return Boolean(data?.some((f) => f.name === audioAssetKey));
}
