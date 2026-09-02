import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Font TTF untuk sertifikat PDF (src/lib/certificatePdf.tsx) dibaca lewat
  // fs.readFileSync di server, bukan lewat import statement — file tracing
  // Next.js tidak menemukannya otomatis, jadi wajib didaftarkan manual
  // supaya ikut ter-bundle saat deploy ke Vercel.
  outputFileTracingIncludes: {
    "/*": ["src/lib/fonts/**/*"],
  },
};

export default nextConfig;
