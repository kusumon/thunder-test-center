/**
 * Buat akun admin pertama, atau RESET password-nya, dari ADMIN_EMAIL /
 * ADMIN_PASSWORD di .env. Tidak ada halaman pendaftaran admin publik
 * (NFR-SEC-002).
 *
 * Untuk penggantian password sehari-hari, pakai menu Admin → Pengaturan →
 * "Ganti password admin". Skrip ini hanya untuk darurat (mis. lupa
 * password): menjalankannya MENIMPA password yang sudah diganti lewat
 * dashboard dengan nilai di .env.
 *
 * Jalankan: npm run db:seed-admin
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/db";

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error("Isi ADMIN_EMAIL dan ADMIN_PASSWORD di .env terlebih dahulu.");
  }
  if (password.length < 8) {
    throw new Error("ADMIN_PASSWORD minimal 8 karakter.");
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const admin = await prisma.adminUser.upsert({
    where: { email },
    update: { passwordHash, failedLoginCount: 0, lockedUntil: null },
    create: { email, passwordHash, role: "SUPERADMIN" },
  });

  console.log(`Admin siap: ${admin.email} (role ${admin.role}).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
