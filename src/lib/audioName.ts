/**
 * Nama file aman untuk storage audio: hanya huruf, angka, `_` dan `-`,
 * selalu berakhiran .mp3. Mencegah path traversal ("../") dan karakter
 * aneh di nama objek Supabase. Fungsi murni supaya bisa diuji sendiri.
 */
export function safeAudioName(fileName: string): string {
  const base = fileName
    .replace(/\.mp3$/i, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return `${base || "listening"}.mp3`;
}
