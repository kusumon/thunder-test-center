/**
 * Validasi & sanitasi nama peserta — SRS FR-001.
 *
 * - 2-120 karakter setelah spasi depan/belakang dibuang.
 * - Tag HTML/script dibuang, bukan hanya di-escape, supaya nama yang
 *   tersimpan sudah bersih di setiap tempat ia ditampilkan (hasil,
 *   sertifikat, dashboard admin) tanpa perlu escaping berulang.
 */
export type NameValidationResult =
  | { ok: true; value: string }
  | { ok: false; error: string };

export function sanitizeParticipantName(rawInput: FormDataEntryValue | null): NameValidationResult {
  if (typeof rawInput !== "string") {
    return { ok: false, error: "Nama wajib diisi." };
  }

  const withoutTags = rawInput.replace(/<[^>]*>/g, "");
  const value = withoutTags.trim().replace(/\s+/g, " ");

  if (value.length < 2) {
    return { ok: false, error: "Nama minimal 2 karakter." };
  }
  if (value.length > 120) {
    return { ok: false, error: "Nama maksimal 120 karakter." };
  }
  return { ok: true, value };
}
