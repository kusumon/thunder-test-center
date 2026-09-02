import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getParticipantSession } from "@/lib/session";
import { getOwnedAttempt } from "@/lib/attempts";
import { generateCertificate } from "@/app/actions";
import { getCertificatePrice, formatRupiah } from "@/lib/settings";
import { Disclaimer } from "@/components/Disclaimer";

export default async function ResultPage({ params }: { params: Promise<{ attemptCode: string }> }) {
  const { attemptCode } = await params;
  const session = await getParticipantSession();
  if (!session) redirect("/");

  const attempt = await getOwnedAttempt(attemptCode, session.id);
  if (!attempt) redirect("/");
  if (attempt.status !== "COMPLETED") redirect(`/test/${attemptCode}/instructions`);

  const [order, price] = await Promise.all([
    prisma.certificateOrder.findUnique({
      where: { attemptId: attempt.id },
      select: { claimCode: true },
    }),
    getCertificatePrice(),
  ]);

  return (
    <main className="container py-5" style={{ maxWidth: 560 }}>
      <div className="text-center mb-4">
        <span className="badge rounded-pill text-bg-success mb-2">Selesai</span>
        <h1 className="h3">Selamat, {attempt.participantNameSnapshot}</h1>
        <p className="text-muted mb-0 font-monospace small">{attempt.publicCode}</p>
      </div>

      <div className="tp-card p-4 mb-4">
        <table className="table mb-0">
          <tbody>
            <tr>
              <td>Listening Comprehension</td>
              <td className="text-end fw-semibold">{attempt.listeningScaled}</td>
            </tr>
            <tr>
              <td>Structure &amp; Written Expression</td>
              <td className="text-end fw-semibold">{attempt.structureScaled}</td>
            </tr>
            <tr>
              <td>Reading Comprehension</td>
              <td className="text-end fw-semibold">{attempt.readingScaled}</td>
            </tr>
            <tr className="border-top">
              <td className="fw-bold pt-3">Overall Prediction Score</td>
              <td className="text-end fw-bold fs-4 text-primary pt-3">{attempt.overallScore}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {order ? (
        <Link href={`/sertifikat/${order.claimCode}`} className="btn tp-btn-primary btn-lg w-100 mb-3">
          Lanjutkan Pemesanan Sertifikat
        </Link>
      ) : (
        <div className="tp-card p-4 mb-3">
          <h2 className="h6 mb-1">Cetak Sertifikat</h2>
          <p className="text-muted small">
            Sertifikat resmi berisi nama, skor, nomor sertifikat, dan QR verifikasi dikenakan biaya{" "}
            <strong>{formatRupiah(price)}</strong>. Pembayaran diverifikasi manual oleh admin.
          </p>
          <form action={generateCertificate.bind(null, attemptCode)}>
            <label htmlFor="whatsappNumber" className="form-label small fw-semibold">
              Nomor WhatsApp Anda
            </label>
            <input
              id="whatsappNumber"
              name="whatsappNumber"
              type="tel"
              inputMode="numeric"
              className="form-control mb-1"
              placeholder="08xxxxxxxxxx"
              required
            />
            <div className="form-text mb-3">
              Dipakai admin untuk memulihkan akses bila kode klaim Anda hilang.
            </div>
            <button type="submit" className="btn tp-btn-primary w-100">
              Pesan Sertifikat
            </button>
          </form>
        </div>
      )}

      <div className="d-flex gap-2 mb-4">
        <Link href="/" className="btn btn-outline-secondary flex-fill">
          Ambil Tes Lagi
        </Link>
        <Link href="/klaim" className="btn btn-outline-secondary flex-fill">
          Buka dengan Kode Klaim
        </Link>
      </div>

      <Disclaimer />
    </main>
  );
}
