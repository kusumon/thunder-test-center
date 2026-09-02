import type { Metadata } from "next";
import { Open_Sans, Poppins } from "next/font/google";
import "./globals.css";

/**
 * Font di-self-host lewat next/font, bukan <link> ke fonts.googleapis.com.
 *
 * Versi sebelumnya menarik 3 keluarga font (Open Sans, Nunito, Poppins)
 * dengan 12 varian bobot langsung dari Google — ~172 KB dan render-blocking
 * dari domain pihak ketiga. Sekarang hanya 2 keluarga dengan bobot yang
 * benar-benar dipakai, disajikan dari domain sendiri tanpa memblokir render.
 * Nunito dihapus: satu-satunya pemakaiannya (tampilan timer) kini memakai
 * Open Sans dengan angka tabular.
 */
const openSans = Open_Sans({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-body",
  display: "swap",
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-heading",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Thunder Test Center — TOEFL Prediction Test",
  description:
    "Tes prediksi/simulasi TOEFL oleh Thunder Test Center — Listening, Structure & Written Expression, Reading Comprehension.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" data-scroll-behavior="smooth" className={`${openSans.variable} ${poppins.variable}`}>
      <head>
        <link rel="stylesheet" href="/niceadmin/vendor/bootstrap/css/bootstrap.min.css" />
      </head>
      <body>{children}</body>
    </html>
  );
}
