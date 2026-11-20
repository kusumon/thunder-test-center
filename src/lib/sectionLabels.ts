import type { SectionTypeValue } from "@/lib/attempts";

/**
 * Nama dan penjelasan tiap bagian tes — satu sumber untuk semua halaman
 * (sebelumnya disalin ulang di 4 file). Aman dipakai di komponen client
 * karena hanya mengimpor tipe.
 */
export const SECTION_INFO: Record<
  SectionTypeValue,
  { name: string; short: string; what: string }
> = {
  LISTENING: {
    name: "Listening Comprehension",
    short: "Listening",
    what: "Mendengarkan percakapan bahasa Inggris",
  },
  STRUCTURE: {
    name: "Structure & Written Expression",
    short: "Structure",
    what: "Tata bahasa (grammar)",
  },
  READING: {
    name: "Reading Comprehension",
    short: "Reading",
    what: "Membaca bacaan bahasa Inggris",
  },
};

export function formatMinutes(durationSeconds: number): string {
  return `${Math.round(durationSeconds / 60)} menit`;
}
