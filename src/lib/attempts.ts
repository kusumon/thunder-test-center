import "server-only";
import { prisma } from "@/lib/db";
import { generatePublicAttemptCode } from "@/lib/publicCode";
import type { Attempt } from "@/generated/prisma/client";

/** Urutan section yang wajib diikuti — FR-008 (tidak boleh loncat ke depan). */
export const SECTION_ORDER = ["LISTENING", "STRUCTURE", "READING"] as const;
export type SectionTypeValue = (typeof SECTION_ORDER)[number];

/**
 * Buat attempt baru, diacak di antara SEMUA paket aktif — SRS §19 ("randomly
 * assign one active equivalent package to a new attempt"), supaya skor
 * tidak bisa melambung lewat hafalan begitu ada lebih dari satu paket
 * setara. Dengan satu paket aktif (kondisi saat ini), perilakunya sama
 * seperti sebelumnya: selalu paket itu yang terpilih.
 */
export async function createAttempt(participantSessionId: string, displayName: string): Promise<Attempt> {
  const activePackages = await prisma.testPackage.findMany({ where: { isActive: true } });
  if (activePackages.length === 0) {
    throw new Error("Tidak ada paket tes aktif. Hubungi administrator.");
  }
  const testPackage = activePackages[Math.floor(Math.random() * activePackages.length)];

  // publicCode acak bisa berbenturan (sangat jarang); coba beberapa kali.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await prisma.attempt.create({
        data: {
          publicCode: generatePublicAttemptCode(),
          participantSessionId,
          testPackageId: testPackage.id,
          participantNameSnapshot: displayName,
          status: "CREATED",
        },
      });
    } catch (error) {
      const isUniqueClash =
        error instanceof Error && "code" in error && (error as { code?: string }).code === "P2002";
      if (!isUniqueClash) throw error;
    }
  }
  throw new Error("Gagal membuat kode attempt unik. Coba lagi.");
}

/**
 * Ambil attempt milik sesi peserta yang sedang login. Mengembalikan `null`
 * kalau kode tidak ditemukan ATAU milik sesi lain — dua kasus itu sengaja
 * disamakan supaya URL attempt tidak bisa dipakai menebak attempt orang
 * lain (tidak membocorkan mana yang "ada tapi bukan milik Anda").
 */
export async function getOwnedAttempt(publicCode: string, participantSessionId: string) {
  return prisma.attempt.findFirst({
    where: { publicCode, participantSessionId },
    include: {
      testPackage: {
        include: { sections: { orderBy: { position: "asc" } } },
      },
      sectionSessions: true,
    },
  });
}

/** Riwayat attempt milik sesi ini, terbaru dulu — SRS §7. */
export async function listAttemptsForSession(participantSessionId: string) {
  return prisma.attempt.findMany({
    where: { participantSessionId },
    orderBy: { startedAt: "desc" },
  });
}
