import { getCertificateForVerification } from "@/lib/certificate";
import { Disclaimer } from "@/components/Disclaimer";

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
    <main className="container py-5" style={{ maxWidth: 560 }}>
      <h1 className="h4 text-center mb-4">Verifikasi Sertifikat</h1>

      {!certificate ? (
        <div className="tp-card p-4 text-center">
          <span className="badge text-bg-secondary mb-2">Tidak Ditemukan</span>
          <p className="mb-0 text-muted">
            Nomor sertifikat <span className="font-monospace">{certificateNumber}</span> tidak
            ditemukan dalam sistem.
          </p>
        </div>
      ) : (
        <div className="tp-card p-4">
          <div className="text-center mb-3">
            {certificate.status === "VALID" ? (
              <>
                <span className="badge text-bg-success fs-6">✓ VALID</span>
                <div className="small text-muted mt-2">Sertifikat ini asli dan terdaftar di sistem kami.</div>
              </>
            ) : (
              <>
                <span className="badge text-bg-danger fs-6">DICABUT (REVOKED)</span>
                <div className="small text-muted mt-2">Sertifikat ini sudah tidak berlaku.</div>
              </>
            )}
          </div>

          <table className="table mb-0">
            <tbody>
              <tr>
                <td className="text-muted">Nomor Sertifikat</td>
                <td className="text-end font-monospace">{certificate.certificateNumber}</td>
              </tr>
              <tr>
                <td className="text-muted">Nama Peserta</td>
                <td className="text-end fw-semibold">{certificate.attempt.participantNameSnapshot}</td>
              </tr>
              <tr>
                <td className="text-muted">Tanggal Tes</td>
                <td className="text-end">
                  {certificate.attempt.completedAt
                    ? new Intl.DateTimeFormat("id-ID", { dateStyle: "long" }).format(
                        certificate.attempt.completedAt,
                      )
                    : "—"}
                </td>
              </tr>
              <tr>
                <td className="text-muted">Listening</td>
                <td className="text-end">{certificate.attempt.listeningScaled}</td>
              </tr>
              <tr>
                <td className="text-muted">Structure</td>
                <td className="text-end">{certificate.attempt.structureScaled}</td>
              </tr>
              <tr>
                <td className="text-muted">Reading</td>
                <td className="text-end">{certificate.attempt.readingScaled}</td>
              </tr>
              <tr className="border-top">
                <td className="fw-bold pt-3">Overall Prediction Score</td>
                <td className="text-end fw-bold fs-5 text-primary pt-3">
                  {certificate.attempt.overallScore}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4">
        <Disclaimer />
      </div>
    </main>
  );
}
