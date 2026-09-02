import { createReadStream, statSync } from "node:fs";
import { Readable } from "node:stream";
import { getParticipantSession } from "@/lib/session";
import { getOwnedAttempt } from "@/lib/attempts";
import { findSectionDefinition, findSectionSession, isSectionTimeUp } from "@/lib/sections";
import { getAudioSource } from "@/lib/audioStorage";

/**
 * Streaming audio Listening — FR-023.
 *
 * - Tidak berada di /public, jadi tidak bisa diakses tanpa lewat route ini.
 * - Hanya bisa diakses peserta pemilik attempt, selama section LISTENING-nya
 *   sedang berjalan (belum disubmit, belum habis waktu).
 * - Di produksi (Supabase dikonfigurasi), route ini mengalihkan (302) ke
 *   signed URL berumur pendek — Range request dan seluruh caching ditangani
 *   CDN Supabase sendiri, bukan server kita.
 * - Di development (fallback lokal), file di-stream langsung dengan
 *   dukungan `Range` supaya elemen <audio> browser bisa memutar file besar
 *   tanpa mengunduh seluruhnya sekaligus. Ini BUKAN dukungan untuk seeking
 *   bebas oleh peserta — UI player kustom di client tidak menyediakan
 *   scrubber (FR-005 strict mode).
 */
export async function GET(request: Request, context: { params: Promise<{ attemptCode: string }> }) {
  const { attemptCode } = await context.params;

  const session = await getParticipantSession();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const attempt = await getOwnedAttempt(attemptCode, session.id);
  if (!attempt) return new Response("Not found", { status: 404 });

  const section = findSectionDefinition(attempt, "LISTENING");
  const sectionSession = findSectionSession(attempt, section.id);
  const active = sectionSession && !sectionSession.submittedAt && !isSectionTimeUp(sectionSession);
  if (!active) return new Response("Audio tidak tersedia untuk attempt ini.", { status: 403 });

  if (!section.audioAssetKey) return new Response("Audio belum diatur.", { status: 404 });

  const remainingSeconds = (sectionSession.endsAt.getTime() - Date.now()) / 1000;
  const source = await getAudioSource(attempt.testPackage.code, section.audioAssetKey, remainingSeconds);

  if (source.type === "redirect") {
    return Response.redirect(source.url, 302);
  }

  const { filePath } = source;
  const stat = statSync(filePath);
  const range = request.headers.get("range");

  const headers = new Headers({
    "Content-Type": "audio/mpeg",
    "Accept-Ranges": "bytes",
    "Cache-Control": "no-store",
    "Content-Disposition": "inline",
  });

  if (!range) {
    headers.set("Content-Length", String(stat.size));
    const body = Readable.toWeb(createReadStream(filePath)) as ReadableStream;
    return new Response(body, { status: 200, headers });
  }

  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  if (!match) return new Response("Range tidak valid", { status: 416 });

  const start = match[1] ? Number(match[1]) : 0;
  const end = match[2] ? Number(match[2]) : stat.size - 1;
  if (start >= stat.size || end >= stat.size || start > end) {
    headers.set("Content-Range", `bytes */${stat.size}`);
    return new Response(null, { status: 416, headers });
  }

  headers.set("Content-Range", `bytes ${start}-${end}/${stat.size}`);
  headers.set("Content-Length", String(end - start + 1));
  const body = Readable.toWeb(createReadStream(filePath, { start, end })) as ReadableStream;
  return new Response(body, { status: 206, headers });
}
