import { notFound } from "next/navigation";
import Link from "next/link";
import { getOrderByClaimCode, buildWhatsAppLink } from "@/lib/certificateOrder";
import { getSettings, formatRupiah } from "@/lib/settings";
import { confirmPayment } from "@/app/actions";
import { Disclaimer } from "@/components/Disclaimer";
import { Icon } from "@/components/Icon";

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
  const approved = order.status === "DISETUJUI" && attempt.certificate;

  return (
    <main className="container py-5" style={{ maxWidth: 620 }}>
      <div className="text-center mb-4">
        <h1 className="h4 mb-1">Sertifikat TOEFL Prediction Test</h1>
        <p className="text-muted mb-0">
          {attempt.participantNameSnapshot} · Skor {attempt.overallScore}
        </p>
      </div>

      <div className="tp-card p-3 mb-4 text-center">
        <div className="text-muted small">Kode klaim Anda — simpan baik-baik</div>
        <div className="fs-4 fw-bold font-monospace text-primary">{order.claimCode}</div>
        <div className="small text-muted">
          Pakai kode ini untuk membuka halaman sertifikat dari perangkat mana pun lewat menu{" "}
          <Link href="/klaim">Buka dengan Kode Klaim</Link>.
        </div>
      </div>

      {approved ? (
        <div className="tp-card p-4 mb-4 text-center">
          <span className="badge text-bg-success mb-3">Pembayaran Disetujui</span>
          <p className="mb-3">Sertifikat Anda sudah terbit dan siap diunduh.</p>
          <div className="font-monospace small text-muted mb-3">
            {attempt.certificate!.certificateNumber}
          </div>
          <a
            href={`/api/sertifikat/${order.claimCode}/pdf`}
            className="btn tp-btn-primary btn-lg w-100 d-flex align-items-center justify-content-center gap-2"
          >
            <Icon name="download" /> Unduh Sertifikat PDF
          </a>
        </div>
      ) : (
        <>
          {order.status === "DITOLAK" && (
            <div className="alert alert-danger">
              <strong>Pembayaran belum dapat dikonfirmasi.</strong>
              <div className="small mt-1">{order.reviewNote}</div>
              <div className="small mt-2">
                Silakan hubungi admin lewat WhatsApp, lalu tekan kembali tombol konfirmasi di bawah.
              </div>
            </div>
          )}

          {order.status === "MENUNGGU_KONFIRMASI" && (
            <div className="alert alert-info">
              <strong>Menunggu verifikasi admin.</strong>
              <div className="small mt-1">
                Konfirmasi biasanya selesai dalam {settings.payment_confirmation_sla}. Halaman ini
                akan menampilkan tombol unduh begitu disetujui — cukup buka ulang dengan kode klaim
                Anda.
              </div>
            </div>
          )}

          <div className="tp-card p-4 mb-3">
            <h2 className="h6 mb-3">Langkah 1 — Transfer sesuai nominal berikut</h2>

            <div className="d-flex justify-content-between border-bottom py-2">
              <span className="text-muted">Bank</span>
              <span className="fw-semibold">{settings.bank_name}</span>
            </div>
            <div className="d-flex justify-content-between border-bottom py-2">
              <span className="text-muted">Nomor rekening</span>
              <span className="fw-semibold font-monospace">
                {settings.bank_account_number || "— belum diatur admin —"}
              </span>
            </div>
            <div className="d-flex justify-content-between border-bottom py-2">
              <span className="text-muted">Atas nama</span>
              <span className="fw-semibold">{settings.bank_account_holder || "—"}</span>
            </div>
            <div className="d-flex justify-content-between align-items-center py-3">
              <span className="text-muted">Nominal transfer</span>
              <span className="fs-4 fw-bold text-primary">{formatRupiah(order.amount)}</span>
            </div>

            <div className="alert alert-warning small mb-0">
              Transfer <strong>tepat sampai 3 angka terakhir</strong>. Angka unik itulah yang dipakai
              admin untuk menemukan pembayaran Anda di mutasi rekening.
            </div>
          </div>

          <div className="tp-card p-4 mb-4">
            <h2 className="h6 mb-3">Langkah 2 — Kirim bukti transfer</h2>
            {waLink ? (
              <a href={waLink} target="_blank" rel="noreferrer" className="btn btn-success w-100 mb-3">
                Konfirmasi via WhatsApp
              </a>
            ) : (
              <div className="alert alert-secondary small">
                Nomor WhatsApp admin belum diatur. Hubungi penyelenggara tes.
              </div>
            )}

            <form action={confirmPayment.bind(null, order.claimCode)}>
              <button type="submit" className="btn btn-outline-primary w-100">
                Saya Sudah Transfer
              </button>
            </form>
            <div className="form-text mt-2">
              Tekan setelah mengirim bukti agar pesanan Anda masuk antrean verifikasi admin.
            </div>
          </div>
        </>
      )}

      <Disclaimer />
    </main>
  );
}
