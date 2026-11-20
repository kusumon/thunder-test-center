import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getParticipantSession } from "@/lib/session";
import { getOwnedAttempt, SECTION_ORDER, type SectionTypeValue } from "@/lib/attempts";
import { findSectionDefinition, findSectionSession, isSectionTimeUp } from "@/lib/sections";
import { SECTION_INFO, formatMinutes } from "@/lib/sectionLabels";
import { startSection } from "@/app/actions";
import { SiteHeader } from "@/components/SiteHeader";
import { LineIcon, SECTION_ICON } from "@/components/LineIcon";

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
    <>
      <SiteHeader />
      <main className="container py-4 py-md-5" style={{ maxWidth: 720 }}>
        {/* Posisi peserta di antara 3 bagian — supaya jelas masih berapa lagi. */}
        <div className="d-flex gap-2 mb-4">
          {SECTION_ORDER.map((type, i) => {
            const done = i < currentIndex;
            const current = i === currentIndex;
            return (
              <div key={type} className="flex-fill">
                <div
                  className="rounded-pill mb-2"
                  style={{
                    height: 6,
                    background: done ? "#16a34a" : current ? "var(--tp-grad)" : "#e2e8f0",
                  }}
                />
                <div
                  className={`small d-flex align-items-center gap-1 ${
                    current ? "fw-bold text-primary" : done ? "text-success" : "text-muted"
                  }`}
                >
                  {done && <LineIcon name="check" size={14} strokeWidth={3} />}
                  {SECTION_INFO[type].short}
                </div>
              </div>
            );
          })}
        </div>

        <div className="tp-card tp-card-accent p-4 p-md-5 mb-4 tp-rise">
          <div className="d-flex gap-3 align-items-center mb-3">
            <div className="tp-icon-chip is-solid" style={{ width: 56, height: 56 }}>
              <LineIcon name={SECTION_ICON[target.type]} size={26} />
            </div>
            <div>
              <div className="tp-eyebrow">
                Bagian {currentIndex + 1} dari {SECTION_ORDER.length}
              </div>
              <h1 className="h3 mb-0">{info.name}</h1>
            </div>
          </div>
          <div className="d-flex flex-wrap gap-2 mb-4">
            <span className="tp-pill">
              <LineIcon name="book" size={14} /> {questionCount} soal
            </span>
            <span className="tp-pill">
              <LineIcon name="clock" size={14} /> {formatMinutes(target.section.durationSeconds)}
            </span>
          </div>

          <h2 className="h6 text-uppercase text-muted" style={{ letterSpacing: "0.08em", fontSize: "0.75rem" }}>
            Petunjuk
          </h2>
          <p className="mb-0" style={{ whiteSpace: "pre-line", lineHeight: 1.75 }}>
            {target.section.instructions}
          </p>
        </div>

        {target.type === "LISTENING" && (
          <div className="tp-card p-4 mb-4">
            <div className="d-flex gap-3 align-items-center mb-3">
              <div className="tp-icon-chip is-sm">
                <LineIcon name="headphones" size={18} />
              </div>
              <h2 className="h6 mb-0">Cara mengerjakan bagian Listening</h2>
            </div>
            <ol className="tp-steps">
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

        <div className="tp-note mb-4 d-flex gap-2">
          <LineIcon name="hourglass" size={20} className="text-primary" />
          <span>
            <strong>Waktu langsung berjalan</strong> setelah Anda menekan tombol di bawah. Jika waktu
            habis, jawaban yang sudah diisi tetap tersimpan dan Anda dibawa ke bagian berikutnya.
          </span>
        </div>

        <form action={startSection.bind(null, attemptCode, target.type)}>
          <button
            type="submit"
            className="btn tp-btn-primary btn-lg w-100 d-flex align-items-center justify-content-center gap-2"
          >
            Mulai Bagian {info.short} <LineIcon name="arrowRight" size={20} />
          </button>
        </form>

        <p className="small text-muted text-center mt-3 mb-0">
          Materi tes dilindungi — dilarang menyalin, merekam, atau menyebarkannya.
        </p>
      </main>
    </>
  );
}
