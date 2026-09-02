import { redirect, notFound } from "next/navigation";
import { getParticipantSession } from "@/lib/session";
import { getOwnedAttempt, SECTION_ORDER, type SectionTypeValue } from "@/lib/attempts";
import {
  findSectionDefinition,
  findSectionSession,
  getPublicSectionContent,
  getSavedAnswers,
  isSectionTimeUp,
} from "@/lib/sections";
import { SectionRunner } from "@/components/SectionRunner";

const SLUG_TO_TYPE: Record<string, SectionTypeValue> = {
  listening: "LISTENING",
  structure: "STRUCTURE",
  reading: "READING",
};

export default async function SectionPage({
  params,
}: {
  params: Promise<{ attemptCode: string; section: string }>;
}) {
  const { attemptCode, section: slug } = await params;
  const sectionType = SLUG_TO_TYPE[slug];
  if (!sectionType) notFound();

  const session = await getParticipantSession();
  if (!session) redirect("/");

  const attempt = await getOwnedAttempt(attemptCode, session.id);
  if (!attempt) redirect("/");
  if (attempt.status === "COMPLETED") redirect(`/result/${attemptCode}`);

  const sectionDef = findSectionDefinition(attempt, sectionType);
  const sectionSession = findSectionSession(attempt, sectionDef.id);

  // Section belum dimulai, atau sudah selesai/waktu habis -> kembali ke hub
  // instruksi supaya server yang menentukan langkah berikutnya (FR-004/FR-008).
  const inProgress = sectionSession && !sectionSession.submittedAt && !isSectionTimeUp(sectionSession);
  if (!inProgress) redirect(`/test/${attemptCode}/instructions`);

  const [{ questions, passages }, savedAnswers] = await Promise.all([
    getPublicSectionContent(sectionDef.id, attempt.id),
    getSavedAnswers(attempt.id, sectionDef.id),
  ]);

  return (
    <SectionRunner
      attemptCode={attemptCode}
      sectionType={sectionType}
      endsAt={sectionSession.endsAt.toISOString()}
      questions={questions}
      passages={passages}
      initialAnswers={Object.fromEntries(savedAnswers)}
      audioPlaysLeft={Math.max(0, sectionDef.audioMaxPlays - sectionSession.audioPlayCount)}
      audioMaxPlays={sectionDef.audioMaxPlays}
    />
  );
}
