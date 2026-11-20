import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getParticipantSession } from "@/lib/session";
import { getOwnedAttempt } from "@/lib/attempts";
import { generateCertificate } from "@/app/actions";
import { getCertificatePrice, formatRupiah } from "@/lib/settings";
import { Disclaimer } from "@/components/Disclaimer";
import { SiteHeader } from "@/components/SiteHeader";
import { LineIcon } from "@/components/LineIcon";

/** Skor total maksimum format TOEFL ITP (68 + 68 + 67) × 10 / 3. */
const MAX_SCORE = 677;

/**
 * Perkiraan level CEFR dari skor total, memakai batas yang lazim dipakai
 * untuk TOEFL ITP. Hanya gambaran untuk peserta — bukan klaim resmi.
 */
function cefrLevel(score: number): { code: string; label: string } {
  if (score >= 627) return { code: "C1", label: "Mahir" };
  if (score >= 543) return { code: "B2", label: "Menengah Atas" };
  if (score >= 460) return { code: "B1", label: "Menengah" };
  if (score >= 337) return { code: "A2", label: "Dasar" };
  return { code: "A1", label: "Pemula" };
}

function ScoreRing({ score }: { score: number }) {
  const size = 200;
  const stroke = 14;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const fraction = Math.max(0.03, Math.min(1, score / MAX_SCORE));

  return (
    <div className="tp-score-ring">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <defs>
          <linearGradient id="score-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#2563eb" />
            <stop offset="100%" stopColor="#22d3ee" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="url(#score-grad)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${circumference * fraction} ${circumference}`}
        />
      </svg>
      <div className="tp-score-ring-value">
        <div className="small text-muted fw-semibold">Skor Anda</div>
        <div className="tp-score-big">{score}</div>
        <div className="small text-muted">dari {MAX_SCORE}</div>
      </div>
    </div>
  );
}

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

  const score = attempt.overallScore ?? 0;
  const level = cefrLevel(score);
  const sectionScores = [
    { label: "Listening", icon: "headphones" as const, value: attempt.listeningScaled },
    { label: "Structure", icon: "pen" as const, value: attempt.structureScaled },
    { label: "Reading", icon: "book" as const, value: attempt.readingScaled },
  ];

  return (
    <>
      <SiteHeader />
      <main className="container py-4 py-md-5" style={{ maxWidth: 600 }}>
        <div className="tp-card tp-card-accent p-4 p-md-5 mb-4 text-center tp-rise">
          <div className="tp-eyebrow mb-1">Tes selesai</div>
          <h1 className="h3 mb-4">Selamat, {attempt.participantNameSnapshot}!</h1>

          <ScoreRing score={score} />

          <div className="mt-3 mb-4">
            <span className="tp-level-badge">
              <LineIcon name="award" size={18} />
              Perkiraan level {level.code} · {level.label}
            </span>
          </div>

          <div className="row g-2">
            {sectionScores.map((s) => (
              <div className="col-4" key={s.label}>
                <div className="tp-mini-score">
                  <div className="d-flex justify-content-center text-primary mb-1">
                    <LineIcon name={s.icon} size={18} />
                  </div>
                  <div className="fs-4 fw-bold text-dark lh-1">{s.value}</div>
                  <div className="small text-muted mt-1">{s.label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {order ? (
          <div className="tp-card p-4 mb-4">
            <div className="d-flex gap-3 align-items-center mb-3">
              <div className="tp-icon-chip">
                <LineIcon name="award" />
              </div>
              <div>
                <h2 className="h5 mb-0">Sertifikat Anda sudah dipesan</h2>
                <div className="small text-muted">Lihat status pembayaran atau unduh sertifikat.</div>
              </div>
            </div>
            <Link
              href={`/sertifikat/${order.claimCode}`}
              className="btn tp-btn-primary btn-lg w-100 d-flex align-items-center justify-content-center gap-2"
            >
              Buka Halaman Sertifikat <LineIcon name="arrowRight" size={20} />
            </Link>
          </div>
        ) : (
          <div className="tp-card p-4 p-md-5 mb-4">
            <div className="d-flex gap-3 align-items-center mb-3">
              <div className="tp-icon-chip is-solid">
                <LineIcon name="award" />
              </div>
              <div>
                <h2 className="h5 mb-0">Dapatkan sertifikat Anda</h2>
                <div className="small text-muted">
                  PDF berisi nama, skor & kode QR verifikasi — <strong>{formatRupiah(price)}</strong>
                </div>
              </div>
            </div>

            <ol className="tp-steps small my-4">
              <li>Isi nomor WhatsApp, lalu tekan Pesan Sertifikat.</li>
              <li>Transfer sesuai nominal yang muncul, lalu kirim bukti lewat WhatsApp.</li>
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
          <Link href="/" className="btn tp-btn-ghost d-inline-flex align-items-center gap-2">
            <LineIcon name="arrowLeft" size={16} /> Kembali ke beranda
          </Link>
        </div>

        <Disclaimer />
      </main>
    </>
  );
}
