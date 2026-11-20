import { getCertificateForVerification } from "@/lib/certificate";
import { Disclaimer } from "@/components/Disclaimer";
import { SiteHeader } from "@/components/SiteHeader";
import { LineIcon } from "@/components/LineIcon";

/**
 * Halaman verifikasi publik — FR-016.
 *
 * SENGAJA tanpa pengecekan sesi/kepemilikan: siapa pun yang memegang nomor
 * sertifikat (mis. calon pemberi kerja) harus bisa memvalidasinya. Proyeksi
 * data (lib/certificate.ts) tidak menyertakan participant_session_id atau
 * riwayat jawaban.
 */
export default async function VerifyPage({
  params,
}: {
  params: Promise<{ certificateNumber: string }>;
}) {
  const { certificateNumber } = await params;
  const certificate = await getCertificateForVerification(certificateNumber);

  return (
    <>
      <SiteHeader />
      <main className="container py-5" style={{ maxWidth: 560 }}>
        <div className="tp-eyebrow text-center mb-1">Verifikasi</div>
        <h1 className="h3 text-center mb-4">Cek Keaslian Sertifikat</h1>

        {!certificate ? (
          <div className="tp-card p-4 p-md-5 text-center">
            <div className="d-flex justify-content-center mb-3">
              <div
                className="tp-icon-chip"
                style={{ width: 64, height: 64, borderRadius: 20, color: "#64748b", background: "#f1f5f9" }}
              >
                <LineIcon name="info" size={30} />
              </div>
            </div>
            <h2 className="h5">Sertifikat tidak ditemukan</h2>
            <p className="mb-0 text-muted">
              Nomor <span className="font-monospace text-dark">{certificateNumber}</span> tidak terdaftar
              di sistem kami.
            </p>
          </div>
        ) : (
          <div className="tp-card tp-card-accent p-4 p-md-5">
            <div className="text-center mb-4">
              {certificate.status === "VALID" ? (
                <>
                  <div className="d-flex justify-content-center mb-3">
                    <div
                      className="tp-icon-chip"
                      style={{
                        width: 72,
                        height: 72,
                        borderRadius: "50%",
                        color: "#fff",
                        background: "linear-gradient(135deg, #16a34a, #22c55e)",
                        boxShadow: "0 12px 30px -10px rgba(22,163,74,0.7)",
                      }}
                    >
                      <LineIcon name="shield" size={34} />
                    </div>
                  </div>
                  <span className="badge text-bg-success fs-6 rounded-pill px-3">VALID</span>
                  <div className="small text-muted mt-2">Sertifikat ini asli dan terdaftar di sistem kami.</div>
                </>
              ) : (
                <>
                  <span className="badge text-bg-danger fs-6 rounded-pill px-3">DICABUT (REVOKED)</span>
                  <div className="small text-muted mt-2">Sertifikat ini sudah tidak berlaku.</div>
                </>
              )}
            </div>

            <div className="text-center mb-4">
              <div className="small text-muted">Diterbitkan untuk</div>
              <div className="fs-4 fw-bold text-dark">{certificate.attempt.participantNameSnapshot}</div>
              <div className="tp-score-big tp-text-gradient mt-2">{certificate.attempt.overallScore}</div>
              <div className="small text-muted">Overall Prediction Score</div>
            </div>

            <div className="row g-2 mb-4 text-center">
              {[
                { label: "Listening", value: certificate.attempt.listeningScaled },
                { label: "Structure", value: certificate.attempt.structureScaled },
                { label: "Reading", value: certificate.attempt.readingScaled },
              ].map((s) => (
                <div className="col-4" key={s.label}>
                  <div className="tp-mini-score">
                    <div className="fs-5 fw-bold text-dark lh-1">{s.value}</div>
                    <div className="small text-muted mt-1">{s.label}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="d-flex justify-content-between border-top pt-3 small">
              <span className="text-muted">No. sertifikat</span>
              <span className="font-monospace text-dark">{certificate.certificateNumber}</span>
            </div>
            <div className="d-flex justify-content-between pt-2 small">
              <span className="text-muted">Tanggal tes</span>
              <span className="text-dark">
                {certificate.attempt.completedAt
                  ? new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeZone: "Asia/Jakarta" }).format(
                      certificate.attempt.completedAt,
                    )
                  : "—"}
              </span>
            </div>
          </div>
        )}

        <div className="mt-4">
          <Disclaimer />
        </div>
      </main>
    </>
  );
}
