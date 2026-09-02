import Link from "next/link";
import { prisma } from "@/lib/db";
import { getParticipantSession } from "@/lib/session";
import { listAttemptsForSession } from "@/lib/attempts";
import { StartTestForm } from "@/components/StartTestForm";
import { Disclaimer } from "@/components/Disclaimer";
import { ThunderMark } from "@/components/Brand";

async function getActivePackageSummary() {
  const testPackage = await prisma.testPackage.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: "asc" },
    include: {
      sections: { orderBy: { position: "asc" }, include: { _count: { select: { questions: true } } } },
    },
  });
  return testPackage;
}

const SECTION_LABEL: Record<string, string> = {
  LISTENING: "Listening Comprehension",
  STRUCTURE: "Structure & Written Expression",
  READING: "Reading Comprehension",
};

export default async function LandingPage() {
  const [testPackage, session] = await Promise.all([getActivePackageSummary(), getParticipantSession()]);
  const history = session ? await listAttemptsForSession(session.id) : [];

  return (
    <main className="container py-5" style={{ maxWidth: 720 }}>
      <div className="text-center mb-4">
        <div className="d-flex justify-content-center mb-3">
          <ThunderMark size={64} id="landing" />
        </div>
        <div className="tp-eyebrow mb-1">Thunder Test Center</div>
        <h1 className="tp-brand display-6">TOEFL PREDICTION TEST</h1>
        <span className="badge rounded-pill text-bg-primary mb-2">Prediction / Simulation Test</span>
        <p className="text-muted mt-2">
          Uji kemampuan Listening, Structure &amp; Written Expression, dan Reading Comprehension Anda.
        </p>
      </div>

      {testPackage && (
        <div className="row g-3 mb-4 text-center">
          {testPackage.sections.map((section) => (
            <div className="col-4" key={section.id}>
              <div className="tp-card p-3 h-100">
                <div className="fs-4 fw-bold text-primary">{section._count.questions}</div>
                <div className="small text-muted">{SECTION_LABEL[section.type] ?? section.type}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="tp-card p-4 p-md-5 mb-4">
        <StartTestForm defaultName={session?.displayName ?? ""} />
      </div>

      {history.length > 0 && (
        <div className="tp-card p-4 mb-4">
          <h2 className="h6 mb-3">Riwayat Attempt Anda</h2>
          <div className="table-responsive">
            <table className="table table-sm align-middle mb-0">
              <thead>
                <tr className="text-muted small">
                  <th>Attempt</th>
                  <th>Tanggal</th>
                  <th>Status</th>
                  <th className="text-end">Skor</th>
                </tr>
              </thead>
              <tbody>
                {history.map((attempt) => (
                  <tr key={attempt.id}>
                    <td className="font-monospace small">{attempt.publicCode}</td>
                    <td className="small">
                      {new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(attempt.startedAt)}
                    </td>
                    <td className="small">
                      {attempt.status === "COMPLETED" ? (
                        <Link href={`/result/${attempt.publicCode}`}>Lihat hasil</Link>
                      ) : (
                        <Link href={`/test/${attempt.publicCode}/instructions`}>Lanjutkan</Link>
                      )}
                    </td>
                    <td className="text-end fw-semibold">{attempt.overallScore ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Disclaimer />
    </main>
  );
}
