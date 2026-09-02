import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";

/**
 * Sesi admin — NFR-SEC-002 (semua rute admin wajib autentikasi), terpisah
 * total dari sesi peserta (cookie beda nama, tidak pernah saling baca).
 *
 * Cookie berisi `<adminUserId>.<expiryMs>.<signature>` yang ditandatangani
 * HMAC-SHA256 pakai ADMIN_AUTH_SECRET — stateless (tidak perlu tabel sesi),
 * tapi tetap diverifikasi ulang ke database setiap request supaya admin
 * yang dihapus/berubah role langsung kehilangan akses tanpa menunggu
 * cookie kedaluwarsa.
 */
const COOKIE_NAME = "toefl_admin_session";
const MAX_AGE_SECONDS = 60 * 60 * 8; // 8 jam

function secret(): string {
  const value = process.env.ADMIN_AUTH_SECRET;
  if (!value) throw new Error("ADMIN_AUTH_SECRET belum diisi. Salin .env.example menjadi .env.");
  return value;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

export async function createAdminSession(adminUserId: string) {
  const expiresAt = Date.now() + MAX_AGE_SECONDS * 1000;
  const payload = `${adminUserId}.${expiresAt}`;
  const token = `${payload}.${sign(payload)}`;

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/admin",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function destroyAdminSession() {
  const store = await cookies();
  store.delete({ name: COOKIE_NAME, path: "/admin" });
}

/** Sesi admin aktif, atau `null` kalau cookie tidak ada/tidak valid/kedaluwarsa/akun sudah tidak ada. */
export async function getAdminSession() {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [adminUserId, expiresAtRaw, signature] = parts;
  const payload = `${adminUserId}.${expiresAtRaw}`;
  if (!safeEqual(signature, sign(payload))) return null;

  const expiresAt = Number(expiresAtRaw);
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return null;

  return prisma.adminUser.findUnique({ where: { id: adminUserId } });
}
