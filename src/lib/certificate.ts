import "server-only";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { readEnv } from "@/lib/env";
import { generateCertificateNumber, normalizeCertificateNumber } from "@/lib/certificateNumber";

/**
 * Sertifikat — SRS §8 (FR-012 s.d. FR-016).
 *
 * Pengaturan institusi/tanda tangan belum punya tabel admin sendiri di
 * data model (Fase 3 belum dikerjakan), jadi sementara dibaca dari env var
 * — bukan hardcode di komponen PDF — supaya operator tetap bisa
 * menggantinya tanpa ubah kode (SRS §21).
 */
export function getCertificateSettings() {
  return {
    institutionName: readEnv("CERTIFICATE_INSTITUTION_NAME") ?? "Thunder Test Center",
    signatoryName: readEnv("CERTIFICATE_SIGNATORY_NAME") ?? "",
    signatoryPosition: readEnv("CERTIFICATE_SIGNATORY_POSITION") ?? "",
    prefix: readEnv("CERTIFICATE_PREFIX") ?? "TOEFLP",
  };
}


/**
 * Buat sertifikat untuk attempt yang sudah selesai, atau kembalikan yang
 * sudah ada (satu sertifikat per attempt — FR-014, kolom `attemptId`
 * unik). Idempoten dengan sengaja: tombol "Generate Certificate" boleh
 * ditekan berkali-kali tanpa membuat nomor baru.
 */
export async function getOrCreateCertificate(attemptId: string) {
  const existing = await prisma.certificate.findUnique({ where: { attemptId } });
  if (existing) return existing;

  const attempt = await prisma.attempt.findUniqueOrThrow({
    where: { id: attemptId },
    include: { testPackage: true },
  });
  if (attempt.status !== "COMPLETED") {
    throw new Error("Sertifikat hanya bisa dibuat untuk attempt yang sudah selesai dinilai.");
  }
  const minScore = attempt.testPackage.certificateMinScore;
  if (minScore !== null && (attempt.overallScore ?? 0) < minScore) {
    throw new Error(`Skor belum mencapai minimum sertifikat (${minScore}).`);
  }

  const { prefix } = getCertificateSettings();
  const issuedAt = new Date();

  // Nomor ACAK, bukan berurutan (lihat lib/certificateNumber.ts). Bentrok
  // nomor hampir mustahil (1 : 1,1 triliun), tapi tetap dicoba ulang.
  for (let attemptNo = 0; attemptNo < 5; attemptNo += 1) {
    try {
      return await prisma.certificate.create({
        data: {
          certificateNumber: generateCertificateNumber(prefix, issuedAt),
          attemptId,
          issuedAt,
          verificationToken: randomBytes(16).toString("hex"),
        },
      });
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code !== "P2002") throw error;
      // Dua persetujuan bersamaan untuk attempt yang sama → pakai yang sudah jadi.
      const raced = await prisma.certificate.findUnique({ where: { attemptId } });
      if (raced) return raced;
      // Selain itu, nomor kebetulan bentrok → ulangi dengan nomor baru.
    }
  }
  throw new Error("Gagal membuat nomor sertifikat unik. Coba lagi.");
}

/** Data lengkap untuk merender PDF — hanya dipanggil setelah ownership diverifikasi pemanggil. */
export async function getCertificateWithAttempt(certificateNumber: string) {
  return prisma.certificate.findUnique({
    where: { certificateNumber },
    include: { attempt: true },
  });
}

/**
 * Proyeksi PUBLIK untuk halaman verifikasi — FR-016. Sengaja TIDAK
 * menyertakan participant_session_id atau riwayat jawaban.
 */
export async function getCertificateForVerification(certificateNumber: string) {
  const certificate = await prisma.certificate.findUnique({
    // Toleran huruf kecil/spasi saat nomor diketik manual.
    where: { certificateNumber: normalizeCertificateNumber(certificateNumber) },
    select: {
      certificateNumber: true,
      status: true,
      issuedAt: true,
      attempt: {
        select: {
          participantNameSnapshot: true,
          overallScore: true,
          listeningScaled: true,
          structureScaled: true,
          readingScaled: true,
          completedAt: true,
        },
      },
    },
  });
  return certificate;
}
