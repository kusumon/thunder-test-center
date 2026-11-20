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

  const sectionScores = [
    { label: "Listening", value: attempt.listeningScaled },
    { label: "Structure", value: attempt.structureScaled },
    { label: "Reading", value: attempt.readingScaled },
  ];

  return (
    <main className="container py-5" style={{ maxWidth: 560 }}>
      <div className="tp-card p-4 p-md-5 mb-4 text-center">
        <div className="text-muted mb-1">Selamat, tes Anda selesai!</div>
        <h1 className="h4 mb-4">{attempt.participantNameSnapshot}</h1>

        <div className="small text-muted text-uppercase fw-semibold" style={{ letterSpacing: "0.1em" }}>
          Skor Anda
        </div>
        <div className="tp-score-big mb-4">{attempt.overallScore}</div>

        <div className="row g-2">
          {sectionScores.map((s) => (
            <div className="col-4" key={s.label}>
              <div className="border rounded-3 py-2">
                <div className="fs-5 fw-bold">{s.value}</div>
                <div className="small text-muted">{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {order ? (
        <div className="tp-card p-4 mb-4 text-center">
          <h2 className="h6 mb-2">Sertifikat Anda sudah dipesan</h2>
          <p className="small text-muted">Lihat status pembayaran atau unduh sertifikat di sini.</p>
          <Link href={`/sertifikat/${order.claimCode}`} className="btn tp-btn-primary btn-lg w-100">
            Buka Halaman Sertifikat
          </Link>
        </div>
      ) : (
        <div className="tp-card p-4 mb-4">
          <h2 className="h5 mb-1">Ingin sertifikat?</h2>
          <p className="text-muted small mb-3">
            Sertifikat PDF berisi nama, skor, dan kode QR untuk dicek keasliannya. Biayanya{" "}
            <strong>{formatRupiah(price)}</strong>.
          </p>

          <ol className="tp-steps small mb-4">
            <li>Isi nomor WhatsApp, lalu tekan Pesan Sertifikat.</li>
            <li>Transfer sesuai nominal yang muncul, lalu kirim bukti ke admin lewat WhatsApp.</li>
            <li>Setelah admin mengecek pembayaran, sertifikat bisa diunduh.</li>
          </ol>

          <form action={generateCertificate.bind(null, attemptCode)}>
            <label htmlFor="whatsappNumber" className="form-label fw-semibold">
              Nomor WhatsApp Anda
            </label>
            <input
              id="whatsappNumber"
              name="whatsappNumber"
              type="tel"
              inputMode="numeric"
              className="form-control form-control-lg mb-1"
              placeholder="Contoh: 081234567890"
              pattern="[0-9+\s\-]{9,20}"
              title="Isi nomor WhatsApp yang aktif, minimal 9 angka"
              required
            />
            <div className="form-text mb-3">Supaya admin bisa menghubungi Anda bila ada kendala.</div>
            <button type="submit" className="btn tp-btn-primary btn-lg w-100">
              Pesan Sertifikat
            </button>
          </form>
        </div>
      )}

      <div className="text-center mb-4">
        <Link href="/" className="btn btn-link">
          ← Kembali ke beranda
        </Link>
      </div>

      <Disclaimer />
    </main>
  );
}
