import "server-only";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { createAdminToken, parseAdminToken, verifyAdminSignature } from "@/lib/adminToken";

/**
 * Sesi admin — NFR-SEC-002 (semua rute admin wajib autentikasi), terpisah
 * total dari sesi peserta (cookie beda nama, tidak pernah saling baca).
 *
 * Cookie berisi `<adminUserId>.<expiryMs>.<signature>` yang ditandatangani
 * HMAC-SHA256 pakai ADMIN_AUTH_SECRET — stateless (tidak perlu tabel sesi),
 * tapi tetap diverifikasi ulang ke database setiap request supaya admin
 * yang dihapus/berubah role langsung kehilangan akses tanpa menunggu
 * cookie kedaluwarsa.
 *
 * Tanda tangan juga diikat ke hash password admin saat ini. Begitu password
 * diganti, SEMUA cookie lama (perangkat lain, atau cookie yang sempat
 * dicuri) otomatis tidak sah lagi — tanpa perlu tabel sesi. Logika tokennya
 * (murni, teruji) ada di lib/adminToken.ts.
 */
const COOKIE_NAME = "toefl_admin_session";
const MAX_AGE_SECONDS = 60 * 60 * 8; // 8 jam

function secret(): string {
  const value = process.env.ADMIN_AUTH_SECRET;
  if (!value) throw new Error("ADMIN_AUTH_SECRET belum diisi. Salin .env.example menjadi .env.");
  return value;
}

export async function createAdminSession(adminUserId: string) {
  const { passwordHash } = await prisma.adminUser.findUniqueOrThrow({
    where: { id: adminUserId },
    select: { passwordHash: true },
  });
  const token = createAdminToken(adminUserId, Date.now() + MAX_AGE_SECONDS * 1000, passwordHash, secret());

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
  const parsed = parseAdminToken(store.get(COOKIE_NAME)?.value);
  if (!parsed) return null;

  const admin = await prisma.adminUser.findUnique({ where: { id: parsed.adminUserId } });
  if (!admin) return null;
  // Diverifikasi SETELAH membaca hash password terbaru dari database —
  // cookie yang dibuat sebelum password diganti tidak akan cocok lagi.
  if (!verifyAdminSignature(parsed, admin.passwordHash, secret())) return null;
  return admin;
}
