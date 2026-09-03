/**
 * Baca env var teks dengan validasi "bukan cuma spasi" — mencegah kelas bug
 * seperti `APP_BASE_URL=" "` yang pernah lolos ke produksi: string spasi
 * itu truthy di JavaScript, jadi `process.env.X || fallback` tidak pernah
 * jatuh ke fallback-nya walau nilainya sebenarnya kosong secara makna.
 */
export function readEnv(key: string): string | undefined {
  const raw = process.env[key];
  const trimmed = raw?.trim();
  return trimmed ? trimmed : undefined;
}
