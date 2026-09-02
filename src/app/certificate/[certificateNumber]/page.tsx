import { redirect, notFound } from "next/navigation";
import { getParticipantSession } from "@/lib/session";
import { getCertificateWithAttempt } from "@/lib/certificate";
import { Disclaimer } from "@/components/Disclaimer";
import { Icon } from "@/components/Icon";

export default async function CertificatePage({
  params,
}: {
  params: Promise<{ certificateNumber: string }>;
}) {
  const { certificateNumber } = await params;
  const session = await getParticipantSession();
  if (!session) redirect("/");

  const certificate = await getCertificateWithAttempt(certificateNumber);
  if (!certificate || certificate.attempt.participantSessionId !== session.id) notFound();

  const { attempt } = certificate;
  const verifyPath = `/verify/${certificate.certificateNumber}`;

  return (
    <main className="container py-5" style={{ maxWidth: 640 }}>
      <div className="text-center mb-4">
        <span className="badge rounded-pill text-bg-primary mb-2">Sertifikat Terbit</span>
        <h1 className="h3">Sertifikat TOEFL Prediction Test</h1>
        <p className="text-muted font-monospace small mb-0">{certificate.certificateNumber}</p>
      </div>

      <div className="tp-card p-4 mb-4 text-center">
        <p className="text-muted mb-1">Diterbitkan untuk</p>
        <h2 className="h4 mb-3">{attempt.participantNameSnapshot}</h2>
        <div className="fs-1 fw-bold text-primary">{attempt.overallScore}</div>
        <div className="text-muted small mb-3">Overall Prediction Score</div>
        <div className="row text-center">
          <div className="col-4">
            <div className="fw-semibold">{attempt.listeningScaled}</div>
            <div className="small text-muted">Listening</div>
          </div>
          <div className="col-4">
            <div className="fw-semibold">{attempt.structureScaled}</div>
            <div className="small text-muted">Structure</div>
          </div>
          <div className="col-4">
            <div className="fw-semibold">{attempt.readingScaled}</div>
            <div className="small text-muted">Reading</div>
          </div>
        </div>
      </div>

      <a
        href={`/api/certificates/${certificate.certificateNumber}/pdf`}
        className="btn tp-btn-primary btn-lg w-100 mb-2"
      >
        <Icon name="download" /> Unduh PDF
      </a>
      <a href={verifyPath} className="btn btn-outline-secondary w-100 mb-4" target="_blank" rel="noreferrer">
        Buka Halaman Verifikasi Publik
      </a>

      <Disclaimer />
    </main>
  );
}
