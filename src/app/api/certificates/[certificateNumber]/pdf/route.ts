import { getParticipantSession } from "@/lib/session";
import { getCertificateWithAttempt, getCertificateSettings } from "@/lib/certificate";
import { renderCertificatePdf } from "@/lib/certificatePdf";

/**
 * Unduh PDF sertifikat — FR-015.
 *
 * Nilai yang dicetak SELALU dibaca ulang dari database di sini, tidak
 * pernah dari data yang dikirim browser. Hanya bisa diakses pemilik
 * attempt (sesi yang sama dengan yang menyelesaikan tes).
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ certificateNumber: string }> },
) {
  const { certificateNumber } = await context.params;

  const session = await getParticipantSession();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const certificate = await getCertificateWithAttempt(certificateNumber);
  if (!certificate || certificate.attempt.participantSessionId !== session.id) {
    return new Response("Not found", { status: 404 });
  }

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
  const baseUrl = process.env.APP_BASE_URL || new URL(request.url).origin;

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
