import { getOrderByClaimCode } from "@/lib/certificateOrder";
import { getCertificateWithAttempt, getCertificateSettings } from "@/lib/certificate";
import { renderCertificatePdf } from "@/lib/certificatePdf";
import { readEnv } from "@/lib/env";

/**
 * Unduh PDF memakai kode klaim (bukan cookie sesi) supaya peserta tetap
 * bisa mengambil sertifikatnya dari perangkat lain setelah membayar.
 *
 * Dua gerbang yang harus lolos: pesanan berstatus DISETUJUI, dan sertifikat
 * memang sudah terbit. Nilainya selalu dibaca ulang dari database.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ claimCode: string }> },
) {
  const { claimCode } = await context.params;

  const order = await getOrderByClaimCode(claimCode.toUpperCase());
  if (!order) return new Response("Not found", { status: 404 });
  if (order.status !== "DISETUJUI") {
    return new Response("Pembayaran belum disetujui.", { status: 403 });
  }

  const certificateNumber = order.attempt.certificate?.certificateNumber;
  if (!certificateNumber) return new Response("Sertifikat belum terbit.", { status: 409 });

  const certificate = await getCertificateWithAttempt(certificateNumber);
  if (!certificate) return new Response("Not found", { status: 404 });

  const { attempt } = certificate;
  if (
    attempt.overallScore === null ||
    attempt.listeningScaled === null ||
    attempt.structureScaled === null ||
    attempt.readingScaled === null ||
    attempt.completedAt === null
  ) {
    return new Response("Attempt belum lengkap dinilai.", { status: 409 });
  }

  const settings = getCertificateSettings();
  const baseUrl = readEnv("APP_BASE_URL") ?? new URL(request.url).origin;

  const pdfBuffer = await renderCertificatePdf({
    certificateNumber: certificate.certificateNumber,
    participantName: attempt.participantNameSnapshot,
    overallScore: attempt.overallScore,
    listeningScaled: attempt.listeningScaled,
    structureScaled: attempt.structureScaled,
    readingScaled: attempt.readingScaled,
    completedAt: attempt.completedAt,
    institutionName: settings.institutionName,
    signatoryName: settings.signatoryName,
    signatoryPosition: settings.signatoryPosition,
    verifyUrl: `${baseUrl}/verify/${certificate.certificateNumber}`,
  });

  return new Response(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="sertifikat-${certificate.certificateNumber}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
