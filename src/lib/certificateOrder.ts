import "server-only";
import { randomInt } from "node:crypto";
import { prisma } from "@/lib/db";
import { getCertificatePrice, getSettings } from "@/lib/settings";
import { getOrCreateCertificate } from "@/lib/certificate";

/** Alfabet kode klaim: tanpa 0/O/1/I supaya tidak salah dibaca/ditulis ulang. */
const CLAIM_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateClaimCode(): string {
  let out = "";
  for (let i = 0; i < 8; i += 1) out += CLAIM_ALPHABET[randomInt(CLAIM_ALPHABET.length)];
  return `TPC-${out.slice(0, 4)}-${out.slice(4)}`;
}

/**
 * Susun nominal transfer: harga pokok + kode unik 3 digit.
 *
 * Kode unik membuat mutasi rekening bisa dicocokkan langsung ke satu
 * pesanan tanpa menebak — dua peserta yang membayar di hari yang sama akan
 * punya nominal berbeda. Yang dicek hanya pesanan yang MASIH menunggu,
 * karena setelah selesai nominal boleh dipakai ulang.
 */
async function allocateAmount(basePrice: number): Promise<number> {
  const pending = await prisma.certificateOrder.findMany({
    where: { status: { in: ["MENUNGGU_PEMBAYARAN", "MENUNGGU_KONFIRMASI"] } },
    select: { amount: true },
  });
  const taken = new Set(pending.map((o) => o.amount));

  for (let i = 0; i < 40; i += 1) {
    const candidate = basePrice + randomInt(1, 1000);
    if (!taken.has(candidate)) return candidate;
  }
  // Semua kode unik sedang terpakai (sangat tidak mungkin: butuh 999 pesanan
  // menggantung bersamaan). Lebih baik gagal terang-terangan daripada
  // membuat nominal ganda yang menyesatkan admin saat rekonsiliasi.
  throw new Error("Kode unik nominal sedang penuh. Coba beberapa saat lagi.");
}

export type OrderWithAttempt = Awaited<ReturnType<typeof getOrderByClaimCode>>;

export async function getOrderByClaimCode(claimCode: string) {
  return prisma.certificateOrder.findUnique({
    where: { claimCode },
    include: {
      attempt: {
        select: {
          publicCode: true,
          participantNameSnapshot: true,
          overallScore: true,
          listeningScaled: true,
          structureScaled: true,
          readingScaled: true,
          completedAt: true,
          certificate: { select: { certificateNumber: true, status: true } },
        },
      },
    },
  });
}

/**
 * Buat pesanan untuk attempt yang sudah selesai, atau kembalikan pesanan
 * yang sudah ada (idempoten — tombol boleh ditekan berkali-kali tanpa
 * menerbitkan tagihan baru).
 */
export async function getOrCreateOrder(attemptId: string, whatsappNumber: string | null) {
  const existing = await prisma.certificateOrder.findUnique({ where: { attemptId } });
  if (existing) {
    if (whatsappNumber && !existing.whatsappNumber) {
      return prisma.certificateOrder.update({
        where: { id: existing.id },
        data: { whatsappNumber },
      });
    }
    return existing;
  }

  const attempt = await prisma.attempt.findUniqueOrThrow({
    where: { id: attemptId },
    include: { testPackage: true },
  });
  if (attempt.status !== "COMPLETED") {
    throw new Error("Pesanan sertifikat hanya bisa dibuat untuk tes yang sudah selesai.");
  }
  const minScore = attempt.testPackage.certificateMinScore;
  if (minScore !== null && (attempt.overallScore ?? 0) < minScore) {
    throw new Error(`Skor belum mencapai minimum sertifikat (${minScore}).`);
  }

  const amount = await allocateAmount(await getCertificatePrice());

  for (let i = 0; i < 5; i += 1) {
    try {
      return await prisma.certificateOrder.create({
        data: { attemptId, claimCode: generateClaimCode(), amount, whatsappNumber },
      });
    } catch (error) {
      const isUniqueClash =
        error instanceof Error && "code" in error && (error as { code?: string }).code === "P2002";
      if (!isUniqueClash) throw error;
    }
  }
  throw new Error("Gagal membuat kode klaim unik. Coba lagi.");
}

/** Peserta menekan "Saya sudah transfer" — hanya mengubah status, tanpa verifikasi. */
export async function markOrderAsPaidClaimed(claimCode: string) {
  const { count } = await prisma.certificateOrder.updateMany({
    where: { claimCode, status: { in: ["MENUNGGU_PEMBAYARAN", "DITOLAK"] } },
    data: { status: "MENUNGGU_KONFIRMASI", paidClaimedAt: new Date(), reviewNote: null },
  });
  return count === 1;
}

/**
 * Admin menyetujui pembayaran. Sertifikat baru diterbitkan DI SINI, jadi
 * adanya baris Certificate sudah berarti pembayaran terverifikasi.
 */
export async function approveOrder(orderId: string, adminUserId: string, note: string) {
  const order = await prisma.certificateOrder.findUniqueOrThrow({ where: { id: orderId } });
  if (order.status === "DISETUJUI") return order;

  await getOrCreateCertificate(order.attemptId);

  return prisma.certificateOrder.update({
    where: { id: orderId },
    data: {
      status: "DISETUJUI",
      reviewedAt: new Date(),
      reviewedById: adminUserId,
      reviewNote: note || null,
    },
  });
}

export async function rejectOrder(orderId: string, adminUserId: string, note: string) {
  if (!note.trim()) throw new Error("Alasan penolakan wajib diisi agar peserta tahu harus apa.");
  return prisma.certificateOrder.update({
    where: { id: orderId },
    data: {
      status: "DITOLAK",
      reviewedAt: new Date(),
      reviewedById: adminUserId,
      reviewNote: note.trim(),
    },
  });
}

/** Tautan WhatsApp berisi pesan siap kirim: kode klaim, nama, dan nominal. */
export async function buildWhatsAppLink(order: {
  claimCode: string;
  amount: number;
  attempt: { participantNameSnapshot: string; publicCode: string };
}) {
  const settings = await getSettings();
  if (!settings.admin_whatsapp) return null;

  const message = [
    "Halo, saya ingin konfirmasi pembayaran sertifikat TOEFL Prediction Test.",
    "",
    `Nama: ${order.attempt.participantNameSnapshot}`,
    `Kode klaim: ${order.claimCode}`,
    `Kode tes: ${order.attempt.publicCode}`,
    `Nominal transfer: Rp${order.amount.toLocaleString("id-ID")}`,
    "",
    "Bukti transfer saya lampirkan di chat ini.",
  ].join("\n");

  const number = settings.admin_whatsapp.replace(/\D/g, "");
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}
