import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getParticipantSession } from "@/lib/session";
import { getOwnedAttempt, SECTION_ORDER, type SectionTypeValue } from "@/lib/attempts";
import { findSectionDefinition, findSectionSession, isSectionTimeUp } from "@/lib/sections";
import { SECTION_INFO, formatMinutes } from "@/lib/sectionLabels";
import { startSection } from "@/app/actions";

export default async function InstructionsPage({
  params,
}: {
  params: Promise<{ attemptCode: string }>;
}) {
  const { attemptCode } = await params;
  const session = await getParticipantSession();
  if (!session) redirect("/");

  const attempt = await getOwnedAttempt(attemptCode, session.id);
  if (!attempt) redirect("/");
  if (attempt.status === "COMPLETED") redirect(`/result/${attemptCode}`);

  // Cari section pertama yang belum tuntas. Kalau sedang berjalan (sudah
  // ditekan "Mulai Bagian" tapi belum submit/waktu belum habis), langsung
  // masuk ke halaman soalnya — layar ini hanya untuk section yang BELUM
  // dimulai (FR-004).
  let target: { type: SectionTypeValue; section: ReturnType<typeof findSectionDefinition> } | null = null;
  for (const type of SECTION_ORDER) {
    const section = findSectionDefinition(attempt, type);
    const sectionSession = findSectionSession(attempt, section.id);
    const done = sectionSession && (sectionSession.submittedAt || isSectionTimeUp(sectionSession));
    if (done) continue;
    if (sectionSession) redirect(`/test/${attemptCode}/${type.toLowerCase()}`);
    target = { type, section };
    break;
  }

  if (!target) redirect(`/test/${attemptCode}/review`);

  const questionCount = await prisma.question.count({
    where: { sectionId: target.section.id, isActive: true },
  });
  const currentIndex = SECTION_ORDER.indexOf(target.type);
  const info = SECTION_INFO[target.type];

  return (
    <main className="container py-5" style={{ maxWidth: 720 }}>
      {/* Posisi peserta di antara 3 bagian — supaya jelas masih berapa lagi. */}
      <div className="d-flex gap-2 mb-4">
        {SECTION_ORDER.map((type, i) => (
          <div key={type} className="flex-fill text-center">
            <div
              className={`rounded-pill mb-1 ${i <= currentIndex ? "bg-primary" : "bg-secondary bg-opacity-25"}`}
              style={{ height: 6 }}
            />
            <div className={`small ${i === currentIndex ? "fw-semibold text-primary" : "text-muted"}`}>
              {i < currentIndex ? "✓ " : ""}
              {SECTION_INFO[type].short}
            </div>
          </div>
        ))}
      </div>

      <div className="mb-4">
        <div className="small text-muted mb-1">
          Bagian {currentIndex + 1} dari {SECTION_ORDER.length}
        </div>
        <h1 className="h3 mb-2">{info.name}</h1>
        <div className="d-flex flex-wrap gap-2">
          <span className="badge rounded-pill text-bg-light border">{questionCount} soal</span>
          <span className="badge rounded-pill text-bg-light border">
            Waktu {formatMinutes(target.section.durationSeconds)}
          </span>
        </div>
      </div>

      <div className="tp-card p-4 mb-4">
        <h2 className="h6">Petunjuk</h2>
        <p className="mb-0" style={{ whiteSpace: "pre-line" }}>
          {target.section.instructions}
        </p>
      </div>

      {target.type === "LISTENING" && (
        <div className="tp-card p-4 mb-4">
          <h2 className="h6">Cara mengerjakan bagian Listening</h2>
          <ol className="tp-steps mt-3">
            <li>Pakai headset atau nyalakan speaker, lalu atur volume.</li>
            <li>
              Tekan tombol <strong>Putar Audio</strong> di halaman soal. Satu audio panjang berisi
              semua soal secara berurutan, mulai dari soal 1.
            </li>
            <li>
              Sambil mendengarkan, pilih jawaban tiap soal lalu tekan <strong>Selanjutnya</strong>.
            </li>
          </ol>
          <div className="small text-muted mt-3">
            Audio bisa diputar <strong>maksimal {target.section.audioMaxPlays} kali</strong> dan
            tidak bisa dijeda atau dimundurkan.
          </div>
        </div>
      )}

      <div className="tp-note mb-3">
        <strong>Waktu langsung berjalan</strong> setelah Anda menekan tombol di bawah. Jika waktu
        habis, jawaban yang sudah diisi tetap tersimpan dan Anda dibawa ke bagian berikutnya.
      </div>

      <form action={startSection.bind(null, attemptCode, target.type)}>
        <button type="submit" className="btn tp-btn-primary btn-lg w-100">
          Mulai Bagian {info.short}
        </button>
      </form>

      <p className="small text-muted text-center mt-3 mb-0">
        Materi tes dilindungi — dilarang menyalin, merekam, atau menyebarkannya.
      </p>
    </main>
  );
}
