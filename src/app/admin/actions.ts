"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { attemptAdminLogin } from "@/lib/adminAuth";
import { createAdminSession, destroyAdminSession, getAdminSession } from "@/lib/adminSession";
import { approveOrder, rejectOrder } from "@/lib/certificateOrder";
import { audioFileExists, createAudioUploadUrl } from "@/lib/audioStorage";
import { saveSettings, SETTING_DEFAULTS, type SettingKey, type Settings } from "@/lib/settings";
import type { ActionResult } from "@/lib/adminLabels";

export type AdminLoginState = { error: string } | null;

export async function adminLogin(_prevState: AdminLoginState, formData: FormData): Promise<AdminLoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Email dan password wajib diisi." };

  const result = await attemptAdminLogin(email, password);
  if (!result.ok) return { error: result.error };

  await createAdminSession(result.adminUserId);
  redirect("/admin");
}

export async function adminLogout() {
  await destroyAdminSession();
  redirect("/admin/login");
}

/**
 * Wajib dipanggil di LUAR blok try: redirect() bekerja dengan melempar
 * error khusus, yang akan tertelan kalau terjadi di dalam try/catch.
 */
async function requireAdmin() {
  const admin = await getAdminSession();
  if (!admin) redirect("/admin/login");
  return admin;
}

function fail(error: unknown, fallback: string): ActionResult {
  return { ok: false, message: error instanceof Error ? error.message : fallback };
}

/** Aktifkan/nonaktifkan paket soal — hanya paket aktif yang diberikan ke peserta (FR-003). */
export async function toggleTestPackageActive(testPackageId: string, nextActive: boolean): Promise<ActionResult> {
  await requireAdmin();
  if (!nextActive) {
    const activeCount = await prisma.testPackage.count({ where: { isActive: true } });
    if (activeCount <= 1) {
      return {
        ok: false,
        message: "Tidak bisa dinonaktifkan: ini satu-satunya paket aktif. Peserta tidak akan bisa mulai tes.",
      };
    }
  }
  await prisma.testPackage.update({ where: { id: testPackageId }, data: { isActive: nextActive } });
  revalidatePath("/admin/tests");
  return { ok: true, message: nextActive ? "Paket diaktifkan." : "Paket dinonaktifkan." };
}

/** Setujui pembayaran → sertifikat langsung terbit. */
export async function approveOrderAction(orderId: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  try {
    await approveOrder(orderId, admin.id, String(formData.get("note") ?? "").trim());
  } catch (error) {
    return fail(error, "Gagal menyetujui pembayaran.");
  }
  // Sengaja tanpa revalidatePath: kartu pesanan akan langsung hilang dari
  // daftar "Perlu dicek" sebelum admin sempat membaca pesan sukses. Client
  // (OrderReviewForm) yang memuat ulang daftar setelah pesan tampil.
  return { ok: true, message: "Disetujui — sertifikat sudah terbit dan bisa diunduh peserta." };
}

/** Tolak pembayaran; alasan wajib supaya peserta tahu langkah berikutnya. */
export async function rejectOrderAction(orderId: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  try {
    await rejectOrder(orderId, admin.id, String(formData.get("note") ?? ""));
  } catch (error) {
    return fail(error, "Gagal menolak pembayaran.");
  }
  return { ok: true, message: "Ditolak — peserta akan melihat alasan Anda di halaman sertifikatnya." };
}

/** Simpan pengaturan pembayaran (harga, rekening, WA admin). */
export async function saveSettingsAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const values: Partial<Settings> = {};
  for (const key of Object.keys(SETTING_DEFAULTS) as SettingKey[]) {
    const raw = formData.get(key);
    if (typeof raw === "string") values[key] = raw.trim();
  }
  if (values.certificate_price !== undefined) {
    const price = Number(values.certificate_price.replace(/\D/g, ""));
    if (!Number.isFinite(price) || price <= 0) {
      return { ok: false, message: "Harga sertifikat harus berupa angka lebih dari 0." };
    }
    values.certificate_price = String(price);
  }
  if (values.admin_whatsapp) {
    const digits = values.admin_whatsapp.replace(/\D/g, "");
    values.admin_whatsapp = digits.startsWith("0") ? `62${digits.slice(1)}` : digits;
  }
  await saveSettings(values);
  revalidatePath("/admin/settings");
  return { ok: true, message: "Pengaturan tersimpan. Halaman peserta langsung memakai nilai baru." };
}

/** Cabut / aktifkan lagi sertifikat — FR-016. */
export async function setCertificateStatus(certificateId: string, status: "VALID" | "REVOKED"): Promise<ActionResult> {
  await requireAdmin();
  await prisma.certificate.update({ where: { id: certificateId }, data: { status } });
  revalidatePath("/admin/certificates");
  return {
    ok: true,
    message: status === "REVOKED" ? "Sertifikat dicabut." : "Sertifikat berlaku lagi.",
  };
}

/** Ubah durasi/instruksi/jumlah putar audio satu bagian — FR-010 (durasi dikonfigurasi, bukan hardcode). */
export async function updateSection(sectionId: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const durationMinutes = Number(formData.get("durationMinutes"));
  const instructions = String(formData.get("instructions") ?? "").trim();
  const audioMaxPlaysRaw = formData.get("audioMaxPlays");

  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
    return { ok: false, message: "Durasi harus berupa angka menit lebih dari 0." };
  }
  if (!instructions) return { ok: false, message: "Petunjuk tidak boleh kosong." };

  const data: { durationSeconds: number; instructions: string; audioMaxPlays?: number } = {
    durationSeconds: Math.round(durationMinutes * 60),
    instructions,
  };
  // Jumlah putar audio hanya ada di formulir bagian Listening.
  if (audioMaxPlaysRaw !== null) {
    const audioMaxPlays = Number(audioMaxPlaysRaw);
    if (!Number.isInteger(audioMaxPlays) || audioMaxPlays < 1) {
      return { ok: false, message: "Jumlah putar audio harus bilangan bulat, minimal 1." };
    }
    data.audioMaxPlays = audioMaxPlays;
  }

  const section = await prisma.section.update({ where: { id: sectionId }, data });
  revalidatePath(`/admin/tests/${section.testPackageId}`);
  return { ok: true, message: "Tersimpan. Berlaku untuk peserta yang memulai bagian ini setelah sekarang." };
}

/** Nama file aman untuk storage: tanpa spasi/karakter aneh, selalu .mp3. */
function safeAudioName(fileName: string): string {
  const base = fileName.replace(/\.mp3$/i, "").replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  return `${base || "listening"}.mp3`;
}

async function getListeningSection(sectionId: string) {
  const section = await prisma.section.findUniqueOrThrow({
    where: { id: sectionId },
    include: { testPackage: { select: { code: true } } },
  });
  if (section.type !== "LISTENING") throw new Error("Audio hanya untuk bagian Listening.");
  return section;
}

/**
 * Langkah 1 unggah audio Listening (SRS §3.2): buat tautan unggah sekali
 * pakai. Browser lalu mengirim file langsung ke Supabase (lihat
 * components/admin/AudioUploader.tsx), bukan lewat server ini.
 */
export async function prepareAudioUpload(
  sectionId: string,
  fileName: string,
): Promise<{ ok: true; signedUrl: string; fileName: string } | { ok: false; message: string }> {
  await requireAdmin();
  if (!fileName.toLowerCase().endsWith(".mp3")) return { ok: false, message: "File harus berformat MP3." };
  try {
    const section = await getListeningSection(sectionId);
    const name = safeAudioName(fileName);
    const signedUrl = await createAudioUploadUrl(section.testPackage.code, name);
    return { ok: true, signedUrl, fileName: name };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Gagal menyiapkan unggahan." };
  }
}

/** Langkah 2: setelah file terkirim, pakai file itu untuk peserta berikutnya. */
export async function finishAudioUpload(sectionId: string, fileName: string): Promise<ActionResult> {
  await requireAdmin();
  try {
    const section = await getListeningSection(sectionId);
    if (!(await audioFileExists(section.testPackage.code, fileName))) {
      return { ok: false, message: "File tidak ditemukan di penyimpanan. Coba unggah ulang." };
    }
    await prisma.section.update({ where: { id: sectionId }, data: { audioAssetKey: fileName } });
    revalidatePath(`/admin/tests/${section.testPackageId}`);
  } catch (error) {
    return fail(error, "Gagal menyimpan audio.");
  }
  return { ok: true, message: `Audio "${fileName}" aktif untuk peserta berikutnya.` };
}

/** Ubah nama & skor minimum sertifikat satu paket soal. */
export async function updateTestPackageDetails(
  testPackageId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const minScoreRaw = String(formData.get("certificateMinScore") ?? "").trim();

  if (!name) return { ok: false, message: "Nama paket tidak boleh kosong." };
  const certificateMinScore = minScoreRaw === "" ? null : Number(minScoreRaw);
  if (certificateMinScore !== null && !Number.isFinite(certificateMinScore)) {
    return { ok: false, message: "Skor minimum harus angka, atau dikosongkan." };
  }

  await prisma.testPackage.update({ where: { id: testPackageId }, data: { name, certificateMinScore } });
  revalidatePath(`/admin/tests/${testPackageId}`);
  return { ok: true, message: "Detail paket tersimpan." };
}

/**
 * Timpa tabel konversi raw->scaled satu bagian dari teks JSON — SRS §6.2
 * (tabel wajib bisa diaudit & diubah admin, bukan hardcode di aplikasi).
 * Format: {"0": 24, "1": 25, ...}
 */
export async function updateConversionTable(
  testPackageId: string,
  sectionType: "LISTENING" | "STRUCTURE" | "READING",
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  const raw = String(formData.get("table") ?? "");

  let entries: { rawScore: number; scaledScore: number }[];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new Error('Format harus seperti {"0": 24, "1": 25}.');
    }
    entries = Object.entries(parsed as Record<string, unknown>).map(([rawScore, scaledScore]) => {
      const r = Number(rawScore);
      const s = Number(scaledScore);
      if (!Number.isInteger(r) || r < 0) throw new Error(`Jumlah benar tidak valid: "${rawScore}".`);
      if (!Number.isInteger(s)) throw new Error(`Skor tidak valid untuk ${rawScore} benar.`);
      return { rawScore: r, scaledScore: s };
    });
    if (entries.length === 0) throw new Error("Tabel tidak boleh kosong.");
  } catch (error) {
    return fail(error instanceof SyntaxError ? new Error("Format tidak valid — periksa tanda kutip dan koma.") : error, "Tabel tidak valid.");
  }

  await prisma.$transaction([
    prisma.scoreConversionRule.deleteMany({ where: { testPackageId, sectionType } }),
    prisma.scoreConversionRule.createMany({
      data: entries.map((e) => ({ testPackageId, sectionType, rawScore: e.rawScore, scaledScore: e.scaledScore })),
    }),
  ]);
  revalidatePath(`/admin/tests/${testPackageId}`);
  return { ok: true, message: `Tabel konversi tersimpan (${entries.length} baris).` };
}
