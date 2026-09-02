/**
 * Helper zona waktu Jakarta (WIB, UTC+7, tanpa DST).
 *
 * Jangan pernah pakai `date.toISOString().slice(0, 10)` untuk menentukan
 * "hari ini" versi lokal — itu memotong berdasarkan UTC, sehingga jam
 * 00:00–06:59 WIB salah dihitung masuk hari sebelumnya.
 */
const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;

/** Awal hari ini (00:00 WIB) sebagai instant UTC. */
export function startOfTodayJakarta(now = new Date()): Date {
  const jakartaWallClock = new Date(now.getTime() + JAKARTA_OFFSET_MS);
  jakartaWallClock.setUTCHours(0, 0, 0, 0);
  return new Date(jakartaWallClock.getTime() - JAKARTA_OFFSET_MS);
}
