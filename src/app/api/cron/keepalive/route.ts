import { keepSupabaseAwake } from "@/lib/audioStorage";
import { readEnv } from "@/lib/env";

/**
 * Dipanggil Vercel Cron sekali sehari (lihat vercel.json) supaya proyek
 * Supabase gratis tidak dijeda karena dianggap tidak aktif — penjelasan
 * lengkap di keepSupabaseAwake() (src/lib/audioStorage.ts).
 *
 * Kalau env CRON_SECRET diisi di Vercel, Vercel otomatis mengirim header
 * `Authorization: Bearer <CRON_SECRET>` dan request tanpa header itu
 * ditolak. Tanpa CRON_SECRET route tetap jalan — isinya hanya beberapa
 * request baca kecil, tidak ada data yang dikembalikan.
 */
export async function GET(request: Request) {
  const secret = readEnv("CRON_SECRET");
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const result = await keepSupabaseAwake();
  if (!result.ok) console.error("[keepalive] Supabase bermasalah:", result.detail);

  return Response.json(
    { ok: result.ok, detail: result.detail, at: new Date().toISOString() },
    { status: result.ok ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
