import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

/**
 * Satu keluarga font untuk judul dan isi: Plus Jakarta Sans (dirancang di
 * Indonesia, geometris dan modern). Di-self-host lewat next/font — tidak
 * ada request ke fonts.googleapis.com dan tidak memblokir render.
 * Variabel --font-body / --font-heading tetap dipakai supaya CSS admin
 * (NiceAdmin) ikut memakai font yang sama tanpa diubah.
 */
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-jakarta",
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#0b1b3f",
};

export const metadata: Metadata = {
  title: "Thunder Test Center — TOEFL Prediction Test",
  description:
    "Tes prediksi/simulasi TOEFL oleh Thunder Test Center — Listening, Structure & Written Expression, Reading Comprehension.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" data-scroll-behavior="smooth" className={jakarta.variable}>
      <head>
        <link rel="stylesheet" href="/niceadmin/vendor/bootstrap/css/bootstrap.min.css" />
      </head>
      <body>{children}</body>
    </html>
  );
}
