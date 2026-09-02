import { redirect } from "next/navigation";
import { getParticipantSession } from "@/lib/session";
import { getOwnedAttempt, SECTION_ORDER, type SectionTypeValue } from "@/lib/attempts";
import { findSectionDefinition, findSectionSession, isSectionTimeUp } from "@/lib/sections";
import { startSection } from "@/app/actions";
import { Disclaimer } from "@/components/Disclaimer";

const SECTION_LABEL: Record<SectionTypeValue, string> = {
  LISTENING: "Listening Comprehension",
  STRUCTURE: "Structure & Written Expression",
  READING: "Reading Comprehension",
};

export default async function InstructionsPage({
  params,
}: {
  params: Promise<{ attemptCode: string }>;
}) {
  const { attemptCode } = await params;
  const session = await getParticipantSession();
  if (!session) redirect("/");

  const attempt = await getOwnedAttempt(attemptCode, session.id);
  if (!attempt) redirect("/");
  if (attempt.status === "COMPLETED") redirect(`/result/${attemptCode}`);

  // Cari section pertama yang belum tuntas. Kalau sedang berjalan (sudah
  // ditekan "Mulai Bagian" tapi belum submit/waktu belum habis), langsung
  // masuk ke halaman soalnya — layar ini hanya untuk section yang BELUM
  // dimulai (FR-004).
  let target: { type: SectionTypeValue; section: ReturnType<typeof findSectionDefinition> } | null = null;
  for (const type of SECTION_ORDER) {
    const section = findSectionDefinition(attempt, type);
    const sectionSession = findSectionSession(attempt, section.id);
    const done = sectionSession && (sectionSession.submittedAt || isSectionTimeUp(sectionSession));
    if (done) continue;
    if (sectionSession) redirect(`/test/${attemptCode}/${type.toLowerCase()}`);
    target = { type, section };
    break;
  }

  if (!target) redirect(`/test/${attemptCode}/review`);

  const minutes = Math.round(target.section.durationSeconds / 60);

  return (
    <main className="container py-5" style={{ maxWidth: 720 }}>
      <div className="mb-4">
        <span className="badge text-bg-secondary mb-2">
          Bagian {SECTION_ORDER.indexOf(target.type) + 1} dari {SECTION_ORDER.length}
        </span>
        <h1 className="h3">{SECTION_LABEL[target.type]}</h1>
        <p className="text-muted mb-0">
          Peserta: <strong>{attempt.participantNameSnapshot}</strong> · Attempt{" "}
          <span className="font-monospace">{attempt.publicCode}</span> · Waktu {minutes} menit
        </p>
      </div>

      <div className="tp-card p-4 mb-4">
        <h2 className="h6">Petunjuk</h2>
        <p style={{ whiteSpace: "pre-line" }}>{target.section.instructions}</p>
      </div>

      <div className="alert alert-warning small">
        Konten tes dilindungi. Menyalin, menyebarkan, merekam, atau menggandakan materi tes tanpa
        izin dilarang.
      </div>

      <form action={startSection.bind(null, attemptCode, target.type)}>
        <button type="submit" className="btn tp-btn-primary btn-lg w-100">
          Mulai Bagian
        </button>
      </form>

      <div className="mt-4">
        <Disclaimer />
      </div>
    </main>
  );
}
