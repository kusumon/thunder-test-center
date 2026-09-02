"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { attemptAdminLogin } from "@/lib/adminAuth";
import { createAdminSession, destroyAdminSession, getAdminSession } from "@/lib/adminSession";
import { approveOrder, rejectOrder } from "@/lib/certificateOrder";
import { uploadAudioFile } from "@/lib/audioStorage";
import {
  saveSettings,
  SETTING_DEFAULTS,
  type SettingKey,
  type Settings,
} from "@/lib/settings";

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

async function requireAdmin() {
  const admin = await getAdminSession();
  if (!admin) redirect("/admin/login");
  return admin;
}

/** Aktifkan/nonaktifkan paket tes — hanya paket aktif yang dilayani ke peserta (FR-003). */
export async function toggleTestPackageActive(testPackageId: string, nextActive: boolean) {
  await requireAdmin();
  await prisma.testPackage.update({ where: { id: testPackageId }, data: { isActive: nextActive } });
  revalidatePath("/admin/tests");
}

/** Setujui pembayaran → sertifikat diterbitkan. */
export async function approveOrderAction(orderId: string, formData: FormData) {
  const admin = await requireAdmin();
  await approveOrder(orderId, admin.id, String(formData.get("note") ?? "").trim());
  revalidatePath("/admin/orders");
}

/** Tolak pembayaran; alasan wajib supaya peserta tahu langkah berikutnya. */
export async function rejectOrderAction(orderId: string, formData: FormData) {
  const admin = await requireAdmin();
  await rejectOrder(orderId, admin.id, String(formData.get("note") ?? ""));
  revalidatePath("/admin/orders");
}

/** Simpan pengaturan pembayaran (harga, rekening, WA admin). */
export async function saveSettingsAction(formData: FormData) {
  await requireAdmin();
  const values: Partial<Settings> = {};
  for (const key of Object.keys(SETTING_DEFAULTS) as SettingKey[]) {
    const raw = formData.get(key);
    if (typeof raw === "string") values[key] = raw.trim();
  }
  if (values.certificate_price !== undefined) {
    const price = Number(values.certificate_price);
    if (!Number.isFinite(price) || price <= 0) {
      throw new Error("Harga sertifikat harus angka positif.");
    }
  }
  await saveSettings(values);
  revalidatePath("/admin/settings");
}

/** Ubah status sertifikat — FR-016, "revoke certificate if necessary". */
export async function setCertificateStatus(certificateId: string, status: "VALID" | "REVOKED") {
  await requireAdmin();
  await prisma.certificate.update({ where: { id: certificateId }, data: { status } });
  revalidatePath("/admin/certificates");
}

/** Ubah durasi/instruksi/mode-ketat satu section — FR-010 (durasi dikonfigurasi, bukan hardcode). */
export async function updateSection(sectionId: string, formData: FormData) {
  await requireAdmin();
  const durationMinutes = Number(formData.get("durationMinutes"));
  const instructions = String(formData.get("instructions") ?? "").trim();
  const strictAudio = formData.get("strictAudio") === "on";
  const audioMaxPlays = Number(formData.get("audioMaxPlays"));

  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
    throw new Error("Durasi harus berupa angka menit yang positif.");
  }
  if (!instructions) throw new Error("Instruksi tidak boleh kosong.");
  if (!Number.isInteger(audioMaxPlays) || audioMaxPlays < 1) {
    throw new Error("Jumlah maksimal pemutaran audio harus bilangan bulat minimal 1.");
  }

  const section = await prisma.section.update({
    where: { id: sectionId },
    data: {
      durationSeconds: Math.round(durationMinutes * 60),
      instructions,
      strictAudio,
      audioMaxPlays,
    },
  });
  revalidatePath(`/admin/tests/${section.testPackageId}`);
}

/**
 * Unggah/ganti audio Listening satu section — SRS §3.2 ("Upload/manage
 * Listening audio"). Hanya berfungsi kalau Supabase Storage dikonfigurasi
 * (lihat src/lib/audioStorage.ts); di lingkungan lokal tanpa Supabase,
 * audio tetap dikelola lewat scripts/upload-audio.ts + file di content/.
 */
export async function uploadListeningAudioAction(sectionId: string, formData: FormData) {
  await requireAdmin();

  const file = formData.get("audio");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Pilih file audio terlebih dahulu.");
  }
  if (!file.type.includes("audio") && !file.name.toLowerCase().endsWith(".mp3")) {
    throw new Error("File harus berformat MP3.");
  }

  const section = await prisma.section.findUniqueOrThrow({
    where: { id: sectionId },
    include: { testPackage: { select: { code: true } } },
  });
  if (section.type !== "LISTENING") throw new Error("Audio hanya berlaku untuk section Listening.");

  const buffer = Buffer.from(await file.arrayBuffer());
  await uploadAudioFile(section.testPackage.code, file.name, buffer);

  await prisma.section.update({ where: { id: sectionId }, data: { audioAssetKey: file.name } });
  revalidatePath(`/admin/tests/${section.testPackageId}`);
}

/** Ubah nama/deskripsi/skor minimum sertifikat satu paket tes. */
export async function updateTestPackageDetails(testPackageId: string, formData: FormData) {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const minScoreRaw = String(formData.get("certificateMinScore") ?? "").trim();

  if (!name) throw new Error("Nama paket tidak boleh kosong.");
  const certificateMinScore = minScoreRaw === "" ? null : Number(minScoreRaw);
  if (certificateMinScore !== null && !Number.isFinite(certificateMinScore)) {
    throw new Error("Skor minimum sertifikat harus angka atau dikosongkan.");
  }

  await prisma.testPackage.update({
    where: { id: testPackageId },
    data: { name, description, certificateMinScore },
  });
  revalidatePath(`/admin/tests/${testPackageId}`);
}

/**
 * Timpa tabel konversi raw->scaled satu section dari teks JSON — SRS §6.2
 * (tabel wajib bisa diaudit & diubah admin, bukan hardcode di aplikasi).
 * Format: {"0": 24, "1": 25, ...}
 */
export async function updateConversionTable(
  testPackageId: string,
  sectionType: "LISTENING" | "STRUCTURE" | "READING",
  formData: FormData,
) {
  await requireAdmin();
  const raw = String(formData.get("table") ?? "");

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("JSON tidak valid.");
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error('Format harus objek, mis. {"0": 24, "1": 25}.');
  }

  const entries = Object.entries(parsed as Record<string, unknown>).map(([rawScore, scaledScore]) => {
    const raw = Number(rawScore);
    const scaled = Number(scaledScore);
    if (!Number.isInteger(raw) || raw < 0) throw new Error(`Raw score tidak valid: "${rawScore}".`);
    if (!Number.isInteger(scaled)) throw new Error(`Scaled score tidak valid untuk raw ${rawScore}.`);
    return { rawScore: raw, scaledScore: scaled };
  });
  if (entries.length === 0) throw new Error("Tabel tidak boleh kosong.");

  await prisma.$transaction([
    prisma.scoreConversionRule.deleteMany({ where: { testPackageId, sectionType } }),
    prisma.scoreConversionRule.createMany({
      data: entries.map((e) => ({ testPackageId, sectionType, rawScore: e.rawScore, scaledScore: e.scaledScore })),
    }),
  ]);
  revalidatePath(`/admin/tests/${testPackageId}`);
}
