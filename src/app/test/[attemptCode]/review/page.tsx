import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getParticipantSession } from "@/lib/session";
import { getOwnedAttempt, SECTION_ORDER, type SectionTypeValue } from "@/lib/attempts";
import { findSectionDefinition, findSectionSession, isSectionTimeUp } from "@/lib/sections";
import { finalSubmit } from "@/app/actions";
import { Disclaimer } from "@/components/Disclaimer";

const SECTION_LABEL: Record<SectionTypeValue, string> = {
  LISTENING: "Listening Comprehension",
  STRUCTURE: "Structure & Written Expression",
  READING: "Reading Comprehension",
};

export default async function ReviewPage({ params }: { params: Promise<{ attemptCode: string }> }) {
  const { attemptCode } = await params;
  const session = await getParticipantSession();
  if (!session) redirect("/");

  const attempt = await getOwnedAttempt(attemptCode, session.id);
  if (!attempt) redirect("/");
  if (attempt.status === "COMPLETED") redirect(`/result/${attemptCode}`);

  const rows = await Promise.all(
    SECTION_ORDER.map(async (type) => {
      const section = findSectionDefinition(attempt, type);
      const sectionSession = findSectionSession(attempt, section.id);
      const done = sectionSession && (sectionSession.submittedAt || isSectionTimeUp(sectionSession));
      if (!done) redirect(`/test/${attemptCode}/instructions`);

      const [total, answered] = await Promise.all([
        prisma.question.count({ where: { sectionId: section.id, isActive: true } }),
        prisma.attemptAnswer.count({ where: { attemptId: attempt.id, question: { sectionId: section.id } } }),
      ]);
      return { type, total, answered };
    }),
  );

  return (
    <main className="container py-5" style={{ maxWidth: 640 }}>
      <h1 className="h3 mb-1">Konfirmasi Akhir</h1>
      <p className="text-muted">
        Periksa ringkasan jawaban Anda. Setelah dikirim, attempt ini tidak dapat diubah lagi (FR-011).
      </p>

      <div className="tp-card p-4 mb-4">
        <table className="table mb-0">
          <tbody>
            {rows.map((row) => (
              <tr key={row.type}>
                <td>{SECTION_LABEL[row.type]}</td>
                <td className="text-end fw-semibold">
                  {row.answered}/{row.total} terjawab
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form action={finalSubmit.bind(null, attemptCode)}>
        <button type="submit" className="btn tp-btn-primary btn-lg w-100">
          Kirim Tes
        </button>
      </form>

      <div className="mt-4">
        <Disclaimer />
      </div>
    </main>
  );
}
