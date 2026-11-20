/**
 * Label berbahasa Indonesia untuk status-status di dashboard admin —
 * supaya admin tidak melihat nilai enum mentah seperti "IN_PROGRESS".
 * Tanpa import server-only: dipakai juga oleh komponen client.
 */

export const ATTEMPT_STATUS: Record<string, { label: string; badge: string }> = {
  CREATED: { label: "Belum mulai", badge: "text-bg-secondary" },
  IN_PROGRESS: { label: "Sedang mengerjakan", badge: "text-bg-warning" },
  COMPLETED: { label: "Selesai", badge: "text-bg-success" },
  EXPIRED: { label: "Kedaluwarsa", badge: "text-bg-secondary" },
};

export const ORDER_STATUS: Record<string, { label: string; badge: string }> = {
  MENUNGGU_PEMBAYARAN: { label: "Belum bayar", badge: "text-bg-secondary" },
  MENUNGGU_KONFIRMASI: { label: "Perlu dicek", badge: "text-bg-warning" },
  DISETUJUI: { label: "Disetujui", badge: "text-bg-success" },
  DITOLAK: { label: "Ditolak", badge: "text-bg-danger" },
};

export const CERT_STATUS: Record<string, { label: string; badge: string }> = {
  VALID: { label: "Berlaku", badge: "text-bg-success" },
  REVOKED: { label: "Dicabut", badge: "text-bg-danger" },
};

const dateTimeFmt = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Jakarta",
});
const dateFmt = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "Asia/Jakarta" });

/** Tanggal + jam dalam WIB. Server Vercel berjalan di UTC, jadi zona waktu wajib eksplisit. */
export function formatDateTime(date: Date | null | undefined): string {
  return date ? `${dateTimeFmt.format(date)} WIB` : "—";
}

export function formatDate(date: Date | null | undefined): string {
  return date ? dateFmt.format(date) : "—";
}

/** Nomor WA peserta (08… / 62…) menjadi tautan wa.me. */
export function waMeLink(number: string | null | undefined): string | null {
  if (!number) return null;
  const digits = number.replace(/\D/g, "");
  if (digits.length < 9) return null;
  const intl = digits.startsWith("0") ? `62${digits.slice(1)}` : digits;
  return `https://wa.me/${intl}`;
}

/** Hasil aksi server admin — ditampilkan sebagai pesan di bawah formulir. */
export type ActionResult = { ok: boolean; message: string } | null;
