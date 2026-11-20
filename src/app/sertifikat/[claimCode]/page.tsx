import { notFound } from "next/navigation";
import Link from "next/link";
import { getOrderByClaimCode, buildWhatsAppLink } from "@/lib/certificateOrder";
import { getSettings, formatRupiah } from "@/lib/settings";
import { confirmPayment } from "@/app/actions";
import { Disclaimer } from "@/components/Disclaimer";
import { Icon } from "@/components/Icon";
import { CopyButton } from "@/components/CopyButton";

/**
 * Halaman pesanan sertifikat, diakses lewat KODE KLAIM — bukan cookie sesi.
 *
 * Kode klaim berfungsi sebagai token pembawa: siapa pun yang memegangnya
 * boleh melihat dan mengunduh. Ini disengaja, karena peserta yang sudah
 * membayar harus tetap bisa mengambil sertifikatnya dari perangkat lain
 * (bayar di HP, cetak di laptop) atau setelah cookie-nya terhapus.
 */
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
  const steps = ["Transfer biaya sertifikat", "Kirim bukti transfer lewat WhatsApp", "Admin mengecek pembayaran", "Unduh sertifikat"];

  return (
    <main className="container py-5" style={{ maxWidth: 620 }}>
      <div className="text-center mb-4">
        <h1 className="h4 mb-1">Sertifikat Anda</h1>
        <p className="text-muted mb-0">
          {attempt.participantNameSnapshot} · Skor {attempt.overallScore}
        </p>
      </div>

      <div className="tp-card p-4 mb-4">
        <ol className="tp-steps">
          {steps.map((label, i) => {
            const n = i + 1;
            const state = n < step ? "is-done" : n === step ? "is-current" : "";
            return (
              <li key={label} className={state}>
                {label}
              </li>
            );
          })}
        </ol>
      </div>

      {approved ? (
        revoked ? (
          <div className="alert alert-danger">
            Sertifikat ini sudah dicabut oleh admin. Silakan hubungi penyelenggara tes.
          </div>
        ) : (
          <div className="tp-card p-4 mb-4 text-center">
            <span className="badge text-bg-success mb-3">Pembayaran disetujui</span>
            <p className="mb-3">Sertifikat Anda sudah siap. Tekan tombol di bawah untuk mengunduh.</p>
            <a
              href={`/api/sertifikat/${order.claimCode}/pdf`}
              className="btn tp-btn-primary btn-lg w-100 d-flex align-items-center justify-content-center gap-2"
            >
              <Icon name="download" /> Unduh Sertifikat (PDF)
            </a>
            <div className="small text-muted mt-3">
              No. sertifikat: <span className="font-monospace">{certificate.certificateNumber}</span>
            </div>
          </div>
        )
      ) : waiting ? (
        <div className="tp-card p-4 mb-4">
          <h2 className="h5 mb-2">Pembayaran Anda sedang dicek admin</h2>
          <p className="text-muted">
            Biasanya selesai dalam <strong>{settings.payment_confirmation_sla}</strong>. Anda tidak perlu
            melakukan apa-apa lagi — buka kembali halaman ini nanti, tombol unduh akan muncul setelah
            disetujui.
          </p>
          <div className="d-flex flex-column gap-2">
            <Link href={`/sertifikat/${order.claimCode}`} className="btn btn-outline-primary">
              Cek status lagi
            </Link>
            {waLink && (
              <a href={waLink} target="_blank" rel="noreferrer" className="btn btn-outline-success">
                Hubungi admin lewat WhatsApp
              </a>
            )}
          </div>
        </div>
      ) : (
        <>
          {order.status === "DITOLAK" && (
            <div className="alert alert-danger">
              <strong>Pembayaran belum bisa dikonfirmasi admin.</strong>
              {order.reviewNote && <div className="mt-1">Alasan: {order.reviewNote}</div>}
              <div className="small mt-2">
                Silakan periksa kembali transfer Anda atau hubungi admin lewat WhatsApp, lalu ulangi
                langkah di bawah.
              </div>
            </div>
          )}

          <div className="tp-card p-4 mb-3">
            <h2 className="h6 mb-3">Langkah 1 — Transfer ke rekening ini</h2>

            <div className="d-flex justify-content-between align-items-center border-bottom py-2 gap-2">
              <span className="text-muted">Bank</span>
              <span className="fw-semibold">{settings.bank_name}</span>
            </div>
            <div className="d-flex justify-content-between align-items-center border-bottom py-2 gap-2">
              <span className="text-muted">No. rekening</span>
              <span className="d-flex align-items-center gap-2">
                <span className="fw-semibold font-monospace">
                  {settings.bank_account_number || "belum diatur admin"}
                </span>
                {settings.bank_account_number && <CopyButton value={settings.bank_account_number} />}
              </span>
            </div>
            <div className="d-flex justify-content-between align-items-center border-bottom py-2 gap-2">
              <span className="text-muted">Atas nama</span>
              <span className="fw-semibold">{settings.bank_account_holder || "—"}</span>
            </div>
            <div className="d-flex justify-content-between align-items-center py-3 gap-2">
              <span className="text-muted">Jumlah transfer</span>
              <span className="d-flex align-items-center gap-2">
                <span className="fs-4 fw-bold text-primary">{formatRupiah(order.amount)}</span>
                <CopyButton value={String(order.amount)} />
              </span>
            </div>

            <div className="tp-note small">
              Transfer <strong>persis {formatRupiah(order.amount)}</strong>, termasuk 3 angka terakhirnya.
              Angka unik ini membantu admin mengenali pembayaran Anda.
            </div>
          </div>

          <div className="tp-card p-4 mb-3">
            <h2 className="h6 mb-2">Langkah 2 — Kirim foto bukti transfer</h2>
            <p className="small text-muted">
              Tombol ini membuka WhatsApp dengan pesan yang sudah terisi. Lampirkan foto/screenshot
              bukti transfer, lalu kirim.
            </p>
            {waLink ? (
              <a href={waLink} target="_blank" rel="noreferrer" className="btn btn-success btn-lg w-100">
                Kirim Bukti lewat WhatsApp
              </a>
            ) : (
              <div className="alert alert-secondary small mb-0">
                Nomor WhatsApp admin belum diatur. Hubungi penyelenggara tes.
              </div>
            )}
          </div>

          <div className="tp-card p-4 mb-4">
            <h2 className="h6 mb-2">Langkah 3 — Beri tahu kami</h2>
            <p className="small text-muted">Tekan tombol ini setelah Anda mengirim bukti transfer.</p>
            <form action={confirmPayment.bind(null, order.claimCode)}>
              <button type="submit" className="btn tp-btn-primary btn-lg w-100">
                Saya Sudah Transfer &amp; Kirim Bukti
              </button>
            </form>
          </div>
        </>
      )}

      <div className="tp-card p-3 mb-4 text-center">
        <div className="small text-muted">Kode klaim Anda</div>
        <div className="d-flex justify-content-center align-items-center gap-2 my-1">
          <span className="fs-4 fw-bold font-monospace text-primary">{order.claimCode}</span>
          <CopyButton value={order.claimCode} />
        </div>
        <div className="small text-muted">
          Simpan kode ini (foto atau screenshot). Dengan kode ini Anda bisa membuka halaman ini lagi
          dari HP/laptop mana pun lewat menu <Link href="/klaim">Buka dengan kode klaim</Link>.
        </div>
      </div>

      <Disclaimer />
    </main>
  );
}
