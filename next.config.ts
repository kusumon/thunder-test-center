import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

/**
 * Content-Security-Policy — hanya mengizinkan sumber yang memang dipakai:
 * file situs sendiri, plus Supabase Storage untuk audio Listening (redirect
 * signed URL) dan unggah audio langsung dari browser admin.
 * 'unsafe-inline' pada script diperlukan oleh skrip inline bawaan Next.js
 * (tanpa sistem nonce); 'unsafe-eval' hanya saat development (Fast Refresh).
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "media-src 'self' https://*.supabase.co",
  "connect-src 'self' https://*.supabase.co",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  // Cegah halaman (mis. tombol Setujui di admin) dibingkai situs lain — clickjacking.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Jangan kirim URL lengkap (berisi kode attempt/kode klaim) ke situs lain.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];

const nextConfig: NextConfig = {
  // Jangan umumkan teknologi server (header X-Powered-By: Next.js).
  poweredByHeader: false,
  // Font TTF untuk sertifikat PDF (src/lib/certificatePdf.tsx) dibaca lewat
  // fs.readFileSync di server, bukan lewat import statement — file tracing
  // Next.js tidak menemukannya otomatis, jadi wajib didaftarkan manual
  // supaya ikut ter-bundle saat deploy ke Vercel.
  outputFileTracingIncludes: {
    "/*": ["src/lib/fonts/**/*"],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
