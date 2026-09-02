import "server-only";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

export type AdminLoginResult =
  | { ok: true; adminUserId: string }
  | { ok: false; error: string };

/**
 * Login admin dengan rate limiting — NFR-SEC-008.
 *
 * Penghitung kegagalan disimpan di baris AdminUser sendiri (bukan tabel
 * terpisah) karena skalanya kecil (satu/segelintir admin). Lima kali gagal
 * berturut-turut mengunci akun itu selama 15 menit; berhasil login mereset
 * penghitung ke nol.
 */
export async function attemptAdminLogin(email: string, password: string): Promise<AdminLoginResult> {
  const admin = await prisma.adminUser.findUnique({ where: { email } });

  // Pesan generik baik untuk email tak ditemukan maupun password salah,
  // supaya percobaan login tidak bisa dipakai menebak email admin yang valid.
  const genericError = "Email atau password salah.";
  if (!admin) return { ok: false, error: genericError };

  if (admin.lockedUntil && admin.lockedUntil.getTime() > Date.now()) {
    const minutesLeft = Math.ceil((admin.lockedUntil.getTime() - Date.now()) / 60000);
    return { ok: false, error: `Terlalu banyak percobaan gagal. Coba lagi dalam ${minutesLeft} menit.` };
  }

  const valid = await bcrypt.compare(password, admin.passwordHash);
  if (!valid) {
    const failedLoginCount = admin.failedLoginCount + 1;
    const lockedOut = failedLoginCount >= MAX_FAILED_ATTEMPTS;
    await prisma.adminUser.update({
      where: { id: admin.id },
      data: {
        failedLoginCount: lockedOut ? 0 : failedLoginCount,
        lockedUntil: lockedOut ? new Date(Date.now() + LOCKOUT_MS) : null,
      },
    });
    return { ok: false, error: genericError };
  }

  await prisma.adminUser.update({
    where: { id: admin.id },
    data: { failedLoginCount: 0, lockedUntil: null },
  });
  return { ok: true, adminUserId: admin.id };
}
