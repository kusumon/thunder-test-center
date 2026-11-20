import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getParticipantSession } from "@/lib/session";
import { getOwnedAttempt, SECTION_ORDER } from "@/lib/attempts";
import { findSectionDefinition, findSectionSession, isSectionTimeUp } from "@/lib/sections";
import { SECTION_INFO } from "@/lib/sectionLabels";
import { finalSubmit } from "@/app/actions";
import { SiteHeader } from "@/components/SiteHeader";
import { LineIcon, SECTION_ICON } from "@/components/LineIcon";

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
    <>
      <SiteHeader />
      <main className="container py-4 py-md-5" style={{ maxWidth: 560 }}>
        <div className="text-center mb-4 tp-rise">
          <div className="d-flex justify-content-center mb-3">
            <div className="tp-icon-chip is-solid" style={{ width: 64, height: 64, borderRadius: 20 }}>
              <LineIcon name="sparkle" size={30} />
            </div>
          </div>
          <h1 className="h3 mb-2">Semua bagian sudah selesai!</h1>
          <p className="text-muted mb-0">Satu langkah lagi: kirim jawaban Anda untuk melihat skor.</p>
        </div>

        <div className="tp-card p-4 mb-4">
          <h2 className="h6 mb-3">Ringkasan jawaban</h2>
          {rows.map((row) => {
            const pct = row.total ? Math.round((row.answered / row.total) * 100) : 0;
            return (
              <div key={row.type} className="mb-3">
                <div className="d-flex justify-content-between align-items-center mb-1">
                  <span className="d-flex align-items-center gap-2 fw-semibold text-dark">
                    <LineIcon name={SECTION_ICON[row.type]} size={18} className="text-primary" />
                    {SECTION_INFO[row.type].short}
                  </span>
                  <span className="small text-muted">
                    {row.answered} dari {row.total} dijawab
                  </span>
                </div>
                <div className="tp-progress-line rounded-pill overflow-hidden" style={{ height: 6 }}>
                  <span style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>

        <form action={finalSubmit.bind(null, attemptCode)}>
          <button
            type="submit"
            className="btn tp-btn-primary btn-lg w-100 d-flex align-items-center justify-content-center gap-2"
          >
            Kirim Jawaban &amp; Lihat Skor <LineIcon name="arrowRight" size={20} />
          </button>
        </form>
        <p className="small text-muted text-center mt-3 mb-0">
          Setelah dikirim, jawaban tidak bisa diubah lagi.
        </p>
      </main>
    </>
  );
}
