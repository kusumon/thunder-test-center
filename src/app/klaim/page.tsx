import Link from "next/link";
import { ClaimCodeForm } from "@/components/ClaimCodeForm";
import { Disclaimer } from "@/components/Disclaimer";

export const metadata = { title: "Buka Sertifikat dengan Kode Klaim" };

export default function ClaimPage() {
  return (
    <main className="container py-5" style={{ maxWidth: 460 }}>
      <div className="text-center mb-4">
        <h1 className="h4">Buka Sertifikat</h1>
        <p className="text-muted small mb-0">
          Masukkan kode klaim yang Anda terima saat memesan sertifikat. Kode ini bekerja dari
          perangkat mana pun, termasuk setelah data browser dibersihkan.
        </p>
      </div>

      <div className="tp-card p-4 mb-4">
        <ClaimCodeForm />
      </div>

      <p className="text-center small text-muted">
        Lupa kode klaim Anda? Hubungi admin lewat WhatsApp dengan menyebutkan nama dan nomor yang
        Anda pakai saat memesan. <Link href="/">Kembali ke beranda</Link>
      </p>

      <Disclaimer />
    </main>
  );
}
