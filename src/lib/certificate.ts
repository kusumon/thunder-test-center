import "server-only";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { readEnv } from "@/lib/env";

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

function formatCertificateNumber(prefix: string, issuedAt: Date, sequence: number): string {
  const year = issuedAt.getUTCFullYear();
  const seq = String(sequence).padStart(6, "0");
  return `${prefix}-${year}-${seq}`;
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

  // sequence Postgres tidak diketahui sebelum baris dibuat, jadi
  // certificateNumber ditulis dua langkah dalam satu transaksi: insert
  // dengan placeholder unik (aman dari bentrok), lalu update begitu
  // sequence sudah ada.
  return prisma.$transaction(async (tx) => {
    const placeholder = `PENDING-${randomBytes(8).toString("hex")}`;
    const created = await tx.certificate.create({
      data: {
        certificateNumber: placeholder,
        attemptId,
        issuedAt,
        verificationToken: randomBytes(16).toString("hex"),
      },
    });
    return tx.certificate.update({
      where: { id: created.id },
      data: { certificateNumber: formatCertificateNumber(prefix, issuedAt, created.sequence) },
    });
  });
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
    where: { certificateNumber },
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
