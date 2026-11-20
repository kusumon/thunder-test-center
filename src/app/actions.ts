"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { sanitizeParticipantName } from "@/lib/name";
import { getOrCreateParticipantSession, getParticipantSession } from "@/lib/session";
import { createAttempt, getOwnedAttempt, SECTION_ORDER, type SectionTypeValue } from "@/lib/attempts";
import {
  assertSectionUnlocked,
  findSectionDefinition,
  findSectionSession,
  isSectionTimeUp,
  saveAnswer,
  startSectionSession,
  submitSectionSession,
} from "@/lib/sections";
import { submitAttempt } from "@/lib/results";
import {
  getOrCreateOrder,
  markOrderAsPaidClaimed,
  getOrderByClaimCode,
} from "@/lib/certificateOrder";

export type StartTestState = { error: string } | null;

/** Landing page (FR-001): validasi nama, buat sesi + attempt, lalu masuk ke instruksi. */
export async function startTest(_prevState: StartTestState, formData: FormData): Promise<StartTestState> {
  const parsed = sanitizeParticipantName(formData.get("name"));
  if (!parsed.ok) return { error: parsed.error };

  const session = await getOrCreateParticipantSession(parsed.value);
  const attempt = await createAttempt(session.id, parsed.value);

  redirect(`/test/${attempt.publicCode}/instructions`);
}

/** Ambil attempt milik sesi yang sedang login, atau lempar 404 kalau tidak cocok. */
async function requireOwnedAttempt(attemptCode: string) {
  const session = await getParticipantSession();
  if (!session) redirect("/");
  const attempt = await getOwnedAttempt(attemptCode, session.id);
  if (!attempt) redirect("/");
  return attempt;
}

/** Tombol "Mulai Bagian" (FR-004) — membuka timer server-authoritative untuk satu section. */
export async function startSection(attemptCode: string, sectionType: SectionTypeValue) {
  const attempt = await requireOwnedAttempt(attemptCode);
  assertSectionUnlocked(attempt, sectionType);
  const section = findSectionDefinition(attempt, sectionType);
  await startSectionSession(attempt.id, section);
  redirect(`/test/${attemptCode}/${sectionType.toLowerCase()}`);
}

/** Auto-save jawaban (FR-009). Dipanggil dari client tanpa navigasi. */
export async function saveAnswerAction(attemptCode: string, questionId: string, choiceKey: string) {
  const attempt = await requireOwnedAttempt(attemptCode);
  if (attempt.status === "COMPLETED") throw new Error("Attempt sudah selesai.");

  // Pastikan questionId benar-benar milik salah satu section attempt ini,
  // dan section-nya masih berjalan (belum disubmit / waktu belum habis),
  // sebelum menulis jawaban.
  const sectionIds = attempt.testPackage.sections.map((s) => s.id);
  const question = await prisma.question.findFirst({
    where: { id: questionId, sectionId: { in: sectionIds } },
  });
  if (!question) throw new Error("Soal tidak ditemukan pada attempt ini.");

  const session = findSectionSession(attempt, question.sectionId);
  if (!session || session.submittedAt || isSectionTimeUp(session)) {
    throw new Error("Bagian ini sudah tidak menerima jawaban.");
  }

  await saveAnswer(attempt.id, questionId, choiceKey);
}

export type AudioPlayGrant = { allowed: boolean; playsUsed: number; playsLeft: number };

/**
 * Catat satu pemutaran audio Listening dan kembalikan sisa jatah — FR-005.
 *
 * Penghitungnya ada di database, bukan di state React, karena state client
 * ter-reset setiap kali halaman di-refresh — peserta bisa memutar audio
 * berkali-kali hanya dengan menekan F5. Increment memakai UPDATE bersyarat
 * (`audioPlayCount < max`) sehingga dua klik bersamaan tidak bisa menembus
 * batas.
 */
export async function requestAudioPlay(attemptCode: string): Promise<AudioPlayGrant> {
  const attempt = await requireOwnedAttempt(attemptCode);
  const section = findSectionDefinition(attempt, "LISTENING");
  const session = findSectionSession(attempt, section.id);

  if (!session || session.submittedAt || isSectionTimeUp(session)) {
    throw new Error("Bagian Listening sudah tidak aktif.");
  }

  const max = section.audioMaxPlays;
  const { count } = await prisma.attemptSectionSession.updateMany({
    where: { id: session.id, audioPlayCount: { lt: max } },
    data: { audioPlayCount: { increment: 1 } },
  });

  const fresh = await prisma.attemptSectionSession.findUniqueOrThrow({
    where: { id: session.id },
    select: { audioPlayCount: true },
  });

  return {
    allowed: count === 1,
    playsUsed: fresh.audioPlayCount,
    playsLeft: Math.max(0, max - fresh.audioPlayCount),
  };
}

/** Tombol "Selesai Bagian" — mengunci section ini dan lanjut ke section berikutnya (atau konfirmasi akhir). */
export async function submitSection(attemptCode: string, sectionType: SectionTypeValue) {
  const attempt = await requireOwnedAttempt(attemptCode);
  const section = findSectionDefinition(attempt, sectionType);
  const session = findSectionSession(attempt, section.id);
  if (session && !session.submittedAt) {
    await submitSectionSession(attempt.id, section.id);
  }

  const nextIndex = SECTION_ORDER.indexOf(sectionType) + 1;
  const next = SECTION_ORDER[nextIndex];
  redirect(next ? `/test/${attemptCode}/instructions` : `/test/${attemptCode}/review`);
}

/** Submit akhir (FR-011) — mengunci attempt secara permanen dan menghitung skor. */
export async function finalSubmit(attemptCode: string) {
  const attempt = await requireOwnedAttempt(attemptCode);
  await submitAttempt(attempt.id);
  redirect(`/result/${attemptCode}`);
}

/** Tombol "Generate Certificate" (FR-012) — hanya untuk attempt milik sesi ini yang sudah selesai. */
export async function generateCertificate(attemptCode: string, formData: FormData) {
  const attempt = await requireOwnedAttempt(attemptCode);
  if (attempt.status !== "COMPLETED") {
    throw new Error("Attempt belum selesai dinilai.");
  }

  const rawNumber = String(formData.get("whatsappNumber") ?? "").replace(/\D/g, "");
  const whatsappNumber = rawNumber.length >= 9 ? rawNumber : null;

  const order = await getOrCreateOrder(attempt.id, whatsappNumber);
  redirect(`/sertifikat/${order.claimCode}`);
}

/** Peserta menyatakan sudah transfer; admin yang memverifikasi. */
export async function confirmPayment(claimCode: string) {
  await markOrderAsPaidClaimed(claimCode);
  redirect(`/sertifikat/${claimCode}`);
}

/** Buka pesanan dari perangkat lain memakai kode klaim. */
export type ClaimState = { error: string } | null;

export async function openByClaimCode(_prev: ClaimState, formData: FormData): Promise<ClaimState> {
  // Toleran terhadap cara orang mengetik ulang kode: huruf kecil, spasi,
  // tanpa tanda hubung, atau tanpa awalan "TPC" — semuanya dinormalkan ke
  // format TPC-XXXX-XXXX.
  let compact = String(formData.get("claimCode") ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  if (!compact) return { error: "Kode klaim wajib diisi." };
  if (compact.length === 8) compact = `TPC${compact}`;
  const code =
    compact.length === 11 && compact.startsWith("TPC")
      ? `TPC-${compact.slice(3, 7)}-${compact.slice(7)}`
      : compact;

  const order = await getOrderByClaimCode(code);
  if (!order) return { error: "Kode klaim tidak ditemukan. Periksa kembali penulisannya." };

  redirect(`/sertifikat/${order.claimCode}`);
}
