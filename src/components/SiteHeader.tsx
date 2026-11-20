import Link from "next/link";
import { ThunderMark } from "@/components/Brand";

/** Header tipis bergaya kaca untuk halaman peserta (selain beranda & halaman soal). */
export function SiteHeader({ linkHome = true }: { linkHome?: boolean }) {
  const brand = (
    <span className="d-inline-flex align-items-center gap-2">
      <ThunderMark size={32} id="site-header" />
      <span className="tp-brand" style={{ fontSize: "0.95rem", letterSpacing: "0.06em" }}>
        THUNDER <span className="tp-text-gradient">TEST CENTER</span>
      </span>
    </span>
  );

  return (
    <header className="tp-site-header">
      <div className="container d-flex align-items-center justify-content-between py-2" style={{ minHeight: 56 }}>
        {linkHome ? (
          <Link href="/" aria-label="Kembali ke beranda">
            {brand}
          </Link>
        ) : (
          brand
        )}
      </div>
    </header>
  );
}
