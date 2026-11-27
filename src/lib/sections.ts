import "server-only";
import { prisma } from "@/lib/db";
import { SECTION_ORDER, type SectionTypeValue } from "@/lib/attempts";
import { seededShuffle } from "@/lib/shuffle";
import type { Attempt, AttemptSectionSession, Section } from "@/generated/prisma/client";

export class SectionAccessError extends Error {}

type AttemptWithSections = Attempt & {
  testPackage: { sections: Section[] };
  sectionSessions: AttemptSectionSession[];
};

/** Section (definisi) untuk tipe tertentu di dalam attempt ini. */
export function findSectionDefinition(attempt: AttemptWithSections, type: SectionTypeValue): Section {
  const section = attempt.testPackage.sections.find((s) => s.type === type);
  if (!section) throw new SectionAccessError(`Section ${type} tidak ada di paket ini.`);
  return section;
}

/** Sesi timer section ini, kalau sudah pernah dimulai. */
export function findSectionSession(
  attempt: AttemptWithSections,
  sectionId: string,
): AttemptSectionSession | undefined {
  return attempt.sectionSessions.find((s) => s.sectionId === sectionId);
}

/**
 * Pastikan peserta boleh membuka/mengerjakan section ini sekarang —
 * FR-008: tidak boleh mengakses section berikutnya sebelum section saat
 * ini disubmit atau waktunya habis.
 */
export function assertSectionUnlocked(attempt: AttemptWithSections, type: SectionTypeValue) {
  if (attempt.status === "COMPLETED") {
    throw new SectionAccessError("Attempt ini sudah selesai.");
  }
  const index = SECTION_ORDER.indexOf(type);
  for (let i = 0; i < index; i += 1) {
    const prevSection = findSectionDefinition(attempt, SECTION_ORDER[i]);
    const prevSession = findSectionSession(attempt, prevSection.id);
    // Section sebelumnya dianggap "selesai" kalau sudah disubmit ATAU
    // waktunya sudah habis (peserta yang menutup browser saat waktu habis
    // tidak boleh terjebak tidak bisa lanjut).
    const prevDone = prevSession && (prevSession.submittedAt || isSectionTimeUp(prevSession));
    if (!prevDone) {
      throw new SectionAccessError(`Selesaikan bagian ${SECTION_ORDER[i]} terlebih dahulu.`);
    }
  }
}

/**
 * Mulai timer section (dipanggil dari tombol "Mulai Bagian" — FR-004).
 * `endsAt` dihitung sekali di server dan menjadi satu-satunya sumber
 * kebenaran; refresh browser tidak pernah mereset timer (FR-010).
 */
export async function startSectionSession(attemptId: string, section: Section) {
  const existing = await prisma.attemptSectionSession.findUnique({
    where: { attemptId_sectionId: { attemptId, sectionId: section.id } },
  });
  if (existing) return existing;

  const startedAt = new Date();
  const endsAt = new Date(startedAt.getTime() + section.durationSeconds * 1000);

  const [session] = await prisma.$transaction([
    prisma.attemptSectionSession.create({
      data: { attemptId, sectionId: section.id, startedAt, endsAt },
    }),
    prisma.attempt.updateMany({
      where: { id: attemptId, status: "CREATED" },
      data: { status: "IN_PROGRESS" },
    }),
  ]);
  return session;
}

export function isSectionTimeUp(session: AttemptSectionSession, now = new Date()): boolean {
  return now.getTime() >= session.endsAt.getTime();
}

/* ------------------------------------------------------------------ *
 * Soal untuk peserta — kunci jawaban TIDAK PERNAH ikut (FR-021/FR-022). *
 * ------------------------------------------------------------------ */

export type PublicChoice = { key: string; text: string };
export type PublicQuestion = {
  id: string;
  number: number;
  questionType: "MCQ" | "ERROR_RECOGNITION";
  stem: string;
  choices: PublicChoice[];
};
export type PublicPassage = {
  id: string;
  title: string | null;
  body: string;
  questions: PublicQuestion[];
};

export function toPublicQuestion(
  question: {
    id: string;
    number: number;
    questionType: "MCQ" | "ERROR_RECOGNITION";
    stem: string;
    choices: { choiceKey: string; text: string }[];
  },
  attemptId: string,
): PublicQuestion {
  // Posisi pilihan diacak per (attempt, soal) — SRS §19. `key` tetap kunci
  // ASLI (dipakai untuk simpan/cocokkan jawaban, sama seperti sebelum ada
  // pengacakan); label A/B/C/D yang tampil ke peserta dihitung ulang dari
  // posisi di client (lihat SectionRunner), bukan dari `key` ini.
  //
  // ERROR_RECOGNITION dikecualikan: A-D di soal itu bukan kandidat jawaban
  // independen, melainkan menunjuk ke bagian bergaris bawah tertentu dalam
  // kalimat SESUAI URUTAN BACA (FR-006). Mengacak urutannya akan memutus
  // korespondensi itu dan membuat soal tidak masuk akal.
  const shuffled =
    question.questionType === "MCQ"
      ? seededShuffle(question.choices, `${attemptId}:${question.id}`)
      : question.choices;
  return {
    id: question.id,
    number: question.number,
    questionType: question.questionType,
    stem: question.stem,
    choices: shuffled.map((c) => ({ key: c.choiceKey, text: c.text })),
  };
}

export async function getPublicSectionContent(sectionId: string, attemptId: string) {
  const section = await prisma.section.findUniqueOrThrow({
    where: { id: sectionId },
    include: {
      questions: {
        where: { passageId: null, isActive: true },
        orderBy: { position: "asc" },
        include: { choices: { orderBy: { position: "asc" } } },
      },
      passages: {
        orderBy: { position: "asc" },
        include: {
          questions: {
            where: { isActive: true },
            orderBy: { position: "asc" },
            include: { choices: { orderBy: { position: "asc" } } },
          },
        },
      },
    },
  });

  const questions = section.questions.map((q) => toPublicQuestion(q, attemptId));
  const passages: PublicPassage[] = section.passages.map((p) => ({
    id: p.id,
    title: p.title,
    body: p.body,
    questions: p.questions.map((q) => toPublicQuestion(q, attemptId)),
  }));

  return { questions, passages, instructions: section.instructions, strictAudio: section.strictAudio };
}

/** Jawaban yang sudah tersimpan untuk attempt ini (dipakai memulihkan state setelah refresh). */
export async function getSavedAnswers(attemptId: string, sectionId: string) {
  const answers = await prisma.attemptAnswer.findMany({
    where: { attemptId, question: { sectionId } },
    select: { questionId: true, selectedChoiceKey: true },
  });
  return new Map(answers.map((a) => [a.questionId, a.selectedChoiceKey]));
}

/**
 * Auto-save satu jawaban — FR-009. Upsert supaya idempoten (peserta boleh
 * ganti pilihan berkali-kali sebelum section disubmit).
 */
export async function saveAnswer(attemptId: string, questionId: string, choiceKey: string) {
  await prisma.attemptAnswer.upsert({
    where: { attemptId_questionId: { attemptId, questionId } },
    update: { selectedChoiceKey: choiceKey, answeredAt: new Date() },
    create: { attemptId, questionId, selectedChoiceKey: choiceKey },
  });
}

/** Tandai section sebagai submitted (dipanggil manual atau otomatis saat waktu habis). */
export async function submitSectionSession(attemptId: string, sectionId: string) {
  await prisma.attemptSectionSession.update({
    where: { attemptId_sectionId: { attemptId, sectionId } },
    data: { submittedAt: new Date() },
  });
}
