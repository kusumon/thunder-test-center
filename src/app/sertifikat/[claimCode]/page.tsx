import { notFound } from "next/navigation";
import Link from "next/link";
import { getOrderByClaimCode, buildWhatsAppLink } from "@/lib/certificateOrder";
import { getSettings, formatRupiah } from "@/lib/settings";
import { confirmPayment } from "@/app/actions";
import { Disclaimer } from "@/components/Disclaimer";
import { CopyButton } from "@/components/CopyButton";
import { SiteHeader } from "@/components/SiteHeader";
import { LineIcon, type LineIconName } from "@/components/LineIcon";

/**
 * Halaman pesanan sertifikat, diakses lewat KODE KLAIM — bukan cookie sesi.
 *
 * Kode klaim berfungsi sebagai token pembawa: siapa pun yang memegangnya
 * boleh melihat dan mengunduh. Ini disengaja, karena peserta yang sudah
 * membayar harus tetap bisa mengambil sertifikatnya dari perangkat lain
 * (bayar di HP, cetak di laptop) atau setelah cookie-nya terhapus.
 */

function StepCard({
  n,
  icon,
  title,
  children,
}: {
  n: number;
  icon: LineIconName;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="tp-card p-4 mb-3">
      <div className="d-flex gap-3 align-items-center mb-3">
        <div className="tp-icon-chip">
          <LineIcon name={icon} />
        </div>
        <div>
          <div className="tp-eyebrow">Langkah {n}</div>
          <h2 className="h6 mb-0">{title}</h2>
        </div>
      </div>
      {children}
    </div>
  );
}

function Row({ label, children, last }: { label: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div
      className={`d-flex justify-content-between align-items-center py-2 gap-2 ${last ? "" : "border-bottom"}`}
    >
      <span className="text-muted small">{label}</span>
      <span className="d-flex align-items-center gap-2 text-end">{children}</span>
    </div>
  );
}

export default async function OrderPage({ params }: { params: Promise<{ claimCode: string }> }) {
  const { claimCode } = await params;
  const order = await getOrderByClaimCode(claimCode.toUpperCase());
  if (!order) notFound();

  const [settings, waLink] = await Promise.all([getSettings(), buildWhatsAppLink(order)]);
  const { attempt } = order;
  const certificate = attempt.certificate;
  const approved = order.status === "DISETUJUI" && certificate;
  const revoked = approved && certificate.status !== "VALID";
  const waiting = order.status === "MENUNGGU_KONFIRMASI";

  // Langkah aktif untuk penanda kemajuan: 1 bayar, 2 kirim bukti, 3 dicek admin, 4 unduh.
  const step = approved ? 4 : waiting ? 3 : 1;
  const steps = ["Transfer biaya", "Kirim bukti", "Dicek admin", "Unduh"];

  return (
    <>
      <SiteHeader />
      <main className="container py-4 py-md-5" style={{ maxWidth: 620 }}>
        <div className="text-center mb-4">
          <div className="tp-eyebrow mb-1">Sertifikat</div>
          <h1 className="h3 mb-1">{attempt.participantNameSnapshot}</h1>
          <span className="tp-pill">Skor {attempt.overallScore}</span>
        </div>

        {/* Penanda kemajuan horizontal 4 langkah. */}
        <div className="tp-card p-3 mb-4">
          <div className="d-flex align-items-start">
            {steps.map((label, i) => {
              const n = i + 1;
              const done = n < step;
              const current = n === step;
              return (
                <div key={label} className="flex-fill text-center position-relative" style={{ minWidth: 0 }}>
                  {i > 0 && (
                    <div
                      className="position-absolute"
                      style={{
                        top: 15,
                        right: "50%",
                        width: "100%",
                        height: 2,
                        background: n <= step ? "#86efac" : "#e2e8f0",
                        zIndex: 0,
                      }}
                    />
                  )}
                  <div
                    className="mx-auto d-flex align-items-center justify-content-center fw-bold position-relative"
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      zIndex: 1,
                      fontSize: "0.85rem",
                      background: done ? "#16a34a" : current ? "var(--tp-grad)" : "#fff",
                      color: done || current ? "#fff" : "var(--tp-text-muted)",
                      border: done || current ? "none" : "2px solid #dbe4f0",
                      boxShadow: current ? "0 0 0 5px rgba(37,99,235,0.15)" : "none",
                    }}
                  >
                    {done ? <LineIcon name="check" size={16} strokeWidth={3} /> : n}
                  </div>
                  <div
                    className={`small mt-2 ${current ? "fw-bold text-dark" : "text-muted"}`}
                    style={{ fontSize: "0.75rem" }}
                  >
                    {label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {approved ? (
          revoked ? (
            <div className="alert alert-danger rounded-4">
              Sertifikat ini sudah dicabut oleh admin. Silakan hubungi penyelenggara tes.
            </div>
          ) : (
            <div className="tp-card tp-card-accent p-4 p-md-5 mb-4 text-center tp-rise">
              <div className="d-flex justify-content-center mb-3">
                <div className="tp-icon-chip is-solid" style={{ width: 64, height: 64, borderRadius: 20 }}>
                  <LineIcon name="award" size={30} />
                </div>
              </div>
              <h2 className="h4 mb-1">Sertifikat Anda siap!</h2>
              <p className="text-muted mb-4">Pembayaran sudah disetujui admin.</p>
              <a
                href={`/api/sertifikat/${order.claimCode}/pdf`}
                className="btn tp-btn-primary btn-lg w-100 d-flex align-items-center justify-content-center gap-2"
              >
                <LineIcon name="download" size={20} /> Unduh Sertifikat (PDF)
              </a>
              <div className="small text-muted mt-3">
                No. sertifikat: <span className="font-monospace text-nowrap">{certificate.certificateNumber}</span>
              </div>
            </div>
          )
        ) : waiting ? (
          <div className="tp-card tp-card-accent p-4 p-md-5 mb-4 text-center">
            <div className="d-flex justify-content-center mb-3">
              <div className="tp-icon-chip" style={{ width: 64, height: 64, borderRadius: 20 }}>
                <LineIcon name="hourglass" size={30} />
              </div>
            </div>
            <h2 className="h5 mb-2">Pembayaran Anda sedang dicek admin</h2>
            <p className="text-muted">
              Biasanya selesai dalam <strong>{settings.payment_confirmation_sla}</strong>. Anda tidak perlu
              melakukan apa-apa lagi — buka kembali halaman ini nanti, tombol unduh akan muncul setelah
              disetujui.
            </p>
            <div className="d-flex flex-column gap-2">
              <Link
                href={`/sertifikat/${order.claimCode}`}
                className="btn tp-btn-primary d-flex align-items-center justify-content-center gap-2"
              >
                <LineIcon name="refresh" size={18} /> Cek status lagi
              </Link>
              {waLink && (
                <a
                  href={waLink}
                  target="_blank"
                  rel="noreferrer"
                  className="btn tp-btn-ghost d-flex align-items-center justify-content-center gap-2"
                >
                  <LineIcon name="chat" size={18} /> Hubungi admin lewat WhatsApp
                </a>
              )}
            </div>
          </div>
        ) : (
          <>
            {order.status === "DITOLAK" && (
              <div className="alert alert-danger rounded-4">
                <strong>Pembayaran belum bisa dikonfirmasi admin.</strong>
                {order.reviewNote && <div className="mt-1">Alasan: {order.reviewNote}</div>}
                <div className="small mt-2">
                  Silakan periksa kembali transfer Anda atau hubungi admin lewat WhatsApp, lalu ulangi
                  langkah di bawah.
                </div>
              </div>
            )}

            <StepCard n={1} icon="card" title="Transfer ke rekening ini">
              <Row label="Bank">
                <span className="fw-semibold text-dark">{settings.bank_name}</span>
              </Row>
              <Row label="No. rekening">
                <span className="fw-semibold font-monospace text-dark">
                  {settings.bank_account_number || "belum diatur admin"}
                </span>
                {settings.bank_account_number && <CopyButton value={settings.bank_account_number} />}
              </Row>
              <Row label="Atas nama" last>
                <span className="fw-semibold text-dark">{settings.bank_account_holder || "—"}</span>
              </Row>

              <div
                className="d-flex justify-content-between align-items-center rounded-4 p-3 mt-3"
                style={{ background: "linear-gradient(135deg, #eff6ff, #ecfeff)" }}
              >
                <div>
                  <div className="small text-muted">Jumlah transfer</div>
                  <div className="fs-3 fw-bold tp-text-gradient lh-sm">{formatRupiah(order.amount)}</div>
                </div>
                <CopyButton value={String(order.amount)} />
              </div>

              <div className="small text-muted mt-3">
                Transfer <strong className="text-dark">persis sampai 3 angka terakhir</strong>. Angka unik
                ini membantu admin mengenali pembayaran Anda.
              </div>
            </StepCard>

            <StepCard n={2} icon="chat" title="Kirim foto bukti transfer">
              <p className="small text-muted">
                Tombol ini membuka WhatsApp dengan pesan yang sudah terisi. Lampirkan foto/screenshot
                bukti transfer, lalu kirim.
              </p>
              {waLink ? (
                <a
                  href={waLink}
                  target="_blank"
                  rel="noreferrer"
                  className="btn tp-btn-success btn-lg w-100 d-flex align-items-center justify-content-center gap-2"
                >
                  <LineIcon name="chat" size={20} /> Kirim Bukti lewat WhatsApp
                </a>
              ) : (
                <div className="alert alert-secondary small mb-0">
                  Nomor WhatsApp admin belum diatur. Hubungi penyelenggara tes.
                </div>
              )}
            </StepCard>

            <StepCard n={3} icon="check" title="Beri tahu kami">
              <p className="small text-muted">Tekan tombol ini setelah Anda mengirim bukti transfer.</p>
              <form action={confirmPayment.bind(null, order.claimCode)}>
                <button type="submit" className="btn tp-btn-primary btn-lg w-100">
                  Saya Sudah Transfer &amp; Kirim Bukti
                </button>
              </form>
            </StepCard>
          </>
        )}

        <div className="tp-card p-4 my-4 text-center" style={{ borderStyle: "dashed", borderWidth: 2 }}>
          <div className="d-flex justify-content-center align-items-center gap-2 small text-muted mb-1">
            <LineIcon name="key" size={16} /> Kode klaim Anda
          </div>
          <div className="d-flex justify-content-center align-items-center gap-2 my-2 flex-wrap">
            <span className="fs-3 fw-bold font-monospace tp-text-gradient text-nowrap">{order.claimCode}</span>
            <CopyButton value={order.claimCode} />
          </div>
          <div className="small text-muted">
            Simpan kode ini (foto atau screenshot). Dengan kode ini Anda bisa membuka halaman ini lagi
            dari HP/laptop mana pun lewat menu <Link href="/klaim">Buka dengan kode klaim</Link>.
          </div>
        </div>

        <Disclaimer />
      </main>
    </>
  );
}
