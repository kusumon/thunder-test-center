import "server-only";
import { prisma } from "@/lib/db";
import { SECTION_ORDER } from "@/lib/attempts";
import { buildConversionTable, toScaledScore, overallPredictionScore } from "@/lib/scoring";
import type { SectionType } from "@/generated/prisma/client";

const RAW_FIELD: Record<SectionType, "listeningRaw" | "structureRaw" | "readingRaw"> = {
  LISTENING: "listeningRaw",
  STRUCTURE: "structureRaw",
  READING: "readingRaw",
};
const SCALED_FIELD: Record<SectionType, "listeningScaled" | "structureScaled" | "readingScaled"> = {
  LISTENING: "listeningScaled",
  STRUCTURE: "structureScaled",
  READING: "readingScaled",
};

/**
 * Penilaian akhir — SRS §6 & NFR-SEC-010.
 *
 * HANYA berjalan di server dan HANYA memakai kunci jawaban dari database;
 * tidak pernah menerima atau mempercayai skor kiriman browser. Idempoten:
 * kalau attempt sudah COMPLETED, kembalikan hasil yang sudah ada tanpa
 * menghitung ulang (attempt yang selesai bersifat immutable — FR-011).
 */
export async function submitAttempt(attemptId: string) {
  const attempt = await prisma.attempt.findUniqueOrThrow({
    where: { id: attemptId },
    include: {
      testPackage: { include: { sections: true, conversionRules: true } },
      sectionSessions: true,
    },
  });

  if (attempt.status === "COMPLETED") return attempt;

  // Bagian dianggap selesai kalau sudah disubmit ATAU waktunya sudah habis —
  // aturan yang sama dengan assertSectionUnlocked() & halaman review.
  // Sebelumnya di sini hanya submittedAt yang diterima, sehingga peserta
  // yang waktunya habis saat tab tertutup (auto-submit browser tidak sempat
  // jalan) terjebak di halaman "Kirim Jawaban" dengan error selamanya.
  const now = new Date();
  const expiredUnsubmitted: { id: string; endsAt: Date }[] = [];
  for (const type of SECTION_ORDER) {
    const section = attempt.testPackage.sections.find((s) => s.type === type);
    const session = attempt.sectionSessions.find((s) => s.sectionId === section?.id);
    if (!session) {
      throw new Error(`Bagian ${type} belum dimulai, tidak bisa mengirim attempt.`);
    }
    if (!session.submittedAt) {
      if (now.getTime() < session.endsAt.getTime()) {
        throw new Error(`Bagian ${type} masih berjalan, tidak bisa mengirim attempt.`);
      }
      expiredUnsubmitted.push({ id: session.id, endsAt: session.endsAt });
    }
  }
  // Catat waktu selesai = saat waktunya habis, supaya data & statistik admin konsisten.
  for (const s of expiredUnsubmitted) {
    await prisma.attemptSectionSession.update({ where: { id: s.id }, data: { submittedAt: s.endsAt } });
  }

  const questions = await prisma.question.findMany({
    where: { section: { testPackageId: attempt.testPackageId } },
    select: { id: true, sectionId: true, section: { select: { type: true } }, correctChoiceKey: true },
  });

  const answers = await prisma.attemptAnswer.findMany({
    where: { attemptId },
    select: { questionId: true, selectedChoiceKey: true },
  });
  const submittedByQuestion = new Map(answers.map((a) => [a.questionId, a.selectedChoiceKey]));

  const rawBySection: Record<SectionType, number> = { LISTENING: 0, STRUCTURE: 0, READING: 0 };
  for (const question of questions) {
    if (submittedByQuestion.get(question.id) === question.correctChoiceKey) {
      rawBySection[question.section.type] += 1;
    }
  }

  const scaledBySection: Record<SectionType, number> = { LISTENING: 0, STRUCTURE: 0, READING: 0 };
  for (const type of SECTION_ORDER) {
    const table = buildConversionTable(
      attempt.testPackage.conversionRules.filter((r) => r.sectionType === type),
    );
    scaledBySection[type] = toScaledScore(rawBySection[type], table);
  }

  const overall = overallPredictionScore(
    scaledBySection.LISTENING,
    scaledBySection.STRUCTURE,
    scaledBySection.READING,
  );

  // Satu UPDATE ber-JOIN untuk seluruh jawaban attempt ini, bukan satu
  // query per soal — dengan ~140 soal, 140 UPDATE terpisah di dalam satu
  // transaksi pernah melebihi batas waktu transaksi interaktif Prisma
  // (5 detik) karena tiap roundtrip ke Postgres punya latensi jaringan.
  await prisma.$transaction(
    [
      prisma.$executeRaw`
        UPDATE attempt_answers aa
        SET is_correct = (aa.selected_choice_key = q.correct_choice_key)
        FROM questions q
        WHERE aa.question_id = q.id AND aa.attempt_id = ${attemptId}::uuid
      `,
      prisma.attempt.update({
        where: { id: attemptId },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
          [RAW_FIELD.LISTENING]: rawBySection.LISTENING,
          [RAW_FIELD.STRUCTURE]: rawBySection.STRUCTURE,
          [RAW_FIELD.READING]: rawBySection.READING,
          [SCALED_FIELD.LISTENING]: scaledBySection.LISTENING,
          [SCALED_FIELD.STRUCTURE]: scaledBySection.STRUCTURE,
          [SCALED_FIELD.READING]: scaledBySection.READING,
          overallScore: overall,
        },
      }),
    ],
    { timeout: 15000 },
  );

  return prisma.attempt.findUniqueOrThrow({ where: { id: attemptId } });
}
