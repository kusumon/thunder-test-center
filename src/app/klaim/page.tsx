import Link from "next/link";
import { ClaimCodeForm } from "@/components/ClaimCodeForm";
import { SiteHeader } from "@/components/SiteHeader";
import { LineIcon } from "@/components/LineIcon";

export const metadata = { title: "Buka Sertifikat — Thunder Test Center" };

export default function ClaimPage() {
  return (
    <>
      <SiteHeader />
      <main className="container py-5" style={{ maxWidth: 460 }}>
        <div className="text-center mb-4 tp-rise">
          <div className="d-flex justify-content-center mb-3">
            <div className="tp-icon-chip is-solid" style={{ width: 64, height: 64, borderRadius: 20 }}>
              <LineIcon name="key" size={30} />
            </div>
          </div>
          <h1 className="h3">Buka Sertifikat</h1>
          <p className="text-muted mb-0">
            Masukkan kode klaim yang Anda dapat saat memesan sertifikat (contoh:{" "}
            <span className="font-monospace text-dark text-nowrap">TPC-AB12-CD34</span>).
          </p>
        </div>

        <div className="tp-card tp-card-accent p-4 mb-4">
          <ClaimCodeForm />
        </div>

        <div className="tp-note small mb-4 d-flex gap-2">
          <LineIcon name="chat" size={18} className="text-primary" />
          <span>
            <strong>Lupa kode klaim?</strong> Hubungi admin lewat WhatsApp, sebutkan nama dan nomor
            WhatsApp yang Anda pakai saat memesan.
          </span>
        </div>

        <div className="text-center">
          <Link href="/" className="btn tp-btn-ghost d-inline-flex align-items-center gap-2">
            <LineIcon name="arrowLeft" size={16} /> Kembali ke beranda
          </Link>
        </div>
      </main>
    </>
  );
}
