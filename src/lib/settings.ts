import "server-only";
import { prisma } from "@/lib/db";

/**
 * Pengaturan global yang boleh diubah admin lewat dashboard tanpa deploy
 * ulang — harga sertifikat, rekening tujuan, dan nomor WA konfirmasi.
 *
 * Disimpan sebagai key-value supaya menambah pengaturan baru tidak perlu
 * migrasi skema. Nilai default di bawah dipakai kalau baris belum ada.
 */
export const SETTING_DEFAULTS = {
  certificate_price: "75000",
  bank_name: "SeaBank",
  bank_account_number: "",
  bank_account_holder: "",
  admin_whatsapp: "",
  payment_confirmation_sla: "1x24 jam",
} as const;

export type SettingKey = keyof typeof SETTING_DEFAULTS;

export const SETTING_LABELS: Record<SettingKey, string> = {
  certificate_price: "Harga sertifikat (Rp)",
  bank_name: "Nama bank",
  bank_account_number: "Nomor rekening",
  bank_account_holder: "Atas nama",
  admin_whatsapp: "Nomor WhatsApp admin (format 62…)",
  payment_confirmation_sla: "Janji waktu konfirmasi",
};

export type Settings = Record<SettingKey, string>;

export async function getSettings(): Promise<Settings> {
  const rows = await prisma.appSetting.findMany();
  const stored = new Map(rows.map((r) => [r.key, r.value]));
  const out = {} as Settings;
  for (const key of Object.keys(SETTING_DEFAULTS) as SettingKey[]) {
    out[key] = stored.get(key) ?? SETTING_DEFAULTS[key];
  }
  return out;
}

export async function saveSettings(values: Partial<Settings>) {
  const entries = Object.entries(values) as [SettingKey, string][];
  await prisma.$transaction(
    entries.map(([key, value]) =>
      prisma.appSetting.upsert({ where: { key }, update: { value }, create: { key, value } }),
    ),
  );
}

/** Harga pokok sertifikat dalam rupiah penuh. */
export async function getCertificatePrice(): Promise<number> {
  const settings = await getSettings();
  const price = Number(settings.certificate_price);
  return Number.isFinite(price) && price > 0 ? Math.round(price) : 75000;
}

export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
}
