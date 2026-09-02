/**
 * Unggah audio Listening satu paket ke Supabase Storage — FR-023, Fase 4.
 *
 * Dijalankan manual oleh admin/dev setiap kali audio baru ditambah atau
 * diganti. Nama objek yang dihasilkan HARUS cocok dengan yang dibaca
 * src/lib/audioStorage.ts saat runtime (slug kode paket + nama file dari
 * config.json) — skrip ini membaca kode paket langsung dari
 * content/<folder>/questions.json supaya keduanya tidak bisa tidak-sinkron.
 *
 * Tidak meng-import src/lib/audioStorage.ts secara langsung karena file itu
 * ditandai "server-only" (hanya boleh jalan lewat bundler Next.js, bukan
 * `tsx` polos) — logikanya sengaja diduplikasi kecil di sini.
 *
 * Pemakaian: npx tsx scripts/upload-audio.ts <folder-di-content>
 * Contoh   : npx tsx scripts/upload-audio.ts test-01
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

function slugifyPackageCode(code: string): string {
  return code.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

async function main() {
  const folder = process.argv[2];
  if (!folder) {
    throw new Error("Pemakaian: npx tsx scripts/upload-audio.ts <folder-di-content>, mis. test-01");
  }
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
    throw new Error("SUPABASE_URL / SUPABASE_SECRET_KEY belum diisi di .env.");
  }

  const dir = join(process.cwd(), "content", folder);
  const bank = JSON.parse(readFileSync(join(dir, "questions.json"), "utf8"));
  const config = JSON.parse(readFileSync(join(dir, "config.json"), "utf8"));

  const packageCode: string = bank.package.code;
  const audioFile: string | null = config.audioFile ?? null;
  if (!audioFile) {
    console.log(`Paket "${packageCode}" tidak punya audioFile di config.json — tidak ada yang diunggah.`);
    return;
  }

  const buffer = readFileSync(join(dir, audioFile));
  console.log(
    `Mengunggah ${audioFile} (${(buffer.length / 1024 / 1024).toFixed(1)} MB) untuk paket ${packageCode}...`,
  );

  const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false },
  });
  const bucket = process.env.SUPABASE_AUDIO_BUCKET || "toefl-audio";

  const { data: buckets, error: listError } = await client.storage.listBuckets();
  if (listError) throw new Error(`Gagal membaca daftar bucket: ${listError.message}`);
  if (!buckets?.some((b) => b.name === bucket)) {
    console.log(`Bucket "${bucket}" belum ada, membuatnya sebagai bucket PRIVATE...`);
    const { error } = await client.storage.createBucket(bucket, { public: false });
    if (error) throw new Error(`Gagal membuat bucket "${bucket}": ${error.message}`);
  }

  const objectPath = `${slugifyPackageCode(packageCode)}/${audioFile}`;
  const { error } = await client.storage
    .from(bucket)
    .upload(objectPath, buffer, { contentType: "audio/mpeg", upsert: true });
  if (error) throw new Error(`Gagal unggah ${objectPath}: ${error.message}`);

  console.log(`Selesai. Object path: ${bucket}/${objectPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
