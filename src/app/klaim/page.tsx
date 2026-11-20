import Link from "next/link";
import { ClaimCodeForm } from "@/components/ClaimCodeForm";

export const metadata = { title: "Buka Sertifikat — Thunder Test Center" };

export default function ClaimPage() {
  return (
    <main className="container py-5" style={{ maxWidth: 460 }}>
      <div className="text-center mb-4">
        <h1 className="h4">Buka Sertifikat</h1>
        <p className="text-muted mb-0">
          Masukkan kode klaim yang Anda dapat saat memesan sertifikat (contoh:{" "}
          <span className="font-monospace">TPC-AB12-CD34</span>).
        </p>
      </div>

      <div className="tp-card p-4 mb-4">
        <ClaimCodeForm />
      </div>

      <div className="tp-note small mb-4">
        <strong>Lupa kode klaim?</strong> Hubungi admin lewat WhatsApp, sebutkan nama dan nomor
        WhatsApp yang Anda pakai saat memesan.
      </div>

      <div className="text-center">
        <Link href="/" className="btn btn-link">
          ← Kembali ke beranda
        </Link>
      </div>
    </main>
  );
}
