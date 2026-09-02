import "server-only";
import { randomBytes, createHash } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";

/**
 * Sesi peserta anonim — SRS FR-002.
 *
 * Cookie hanya berisi token acak beropasitas tinggi (32 byte). Yang
 * disimpan di database adalah HASH dari token itu, bukan token mentahnya,
 * supaya kebocoran database saja tidak cukup untuk memalsukan sesi orang
 * lain (token tetap diperlukan, dan itu hanya ada di cookie browser).
 */
const COOKIE_NAME = "toefl_session";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 hari

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

async function readSessionFromCookie() {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const session = await prisma.participantSession.findUnique({
    where: { sessionTokenHash: hashToken(token) },
  });
  return session;
}

async function createSessionCookie(displayName: string) {
  const token = randomBytes(32).toString("hex");
  const session = await prisma.participantSession.create({
    data: { displayName, sessionTokenHash: hashToken(token) },
  });

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE_SECONDS,
  });

  return session;
}

/**
 * Kembalikan sesi peserta aktif, membuat sesi (dan cookie) baru bila belum
 * ada. `displayName` yang diberikan hanya dipakai ketika sesi baru dibuat
 * atau saat peserta mengganti nama pada retake (lihat SRS §7).
 */
export async function getOrCreateParticipantSession(displayName: string) {
  const existing = await readSessionFromCookie();
  if (existing) {
    if (existing.displayName === displayName) {
      return prisma.participantSession.update({
        where: { id: existing.id },
        data: { lastSeenAt: new Date() },
      });
    }
    return prisma.participantSession.update({
      where: { id: existing.id },
      data: { displayName, lastSeenAt: new Date() },
    });
  }
  return createSessionCookie(displayName);
}

/** Sesi aktif tanpa membuat sesi baru — dipakai untuk prefill nama di landing page. */
export async function getParticipantSession() {
  return readSessionFromCookie();
}
