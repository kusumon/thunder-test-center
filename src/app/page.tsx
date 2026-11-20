import Link from "next/link";
import { prisma } from "@/lib/db";
import { getParticipantSession } from "@/lib/session";
import { listAttemptsForSession, type SectionTypeValue } from "@/lib/attempts";
import { SECTION_INFO, formatMinutes } from "@/lib/sectionLabels";
import { StartTestForm } from "@/components/StartTestForm";
import { Disclaimer } from "@/components/Disclaimer";
import { ThunderMark } from "@/components/Brand";

async function getActivePackageSummary() {
  const testPackage = await prisma.testPackage.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: "asc" },
    include: {
      sections: { orderBy: { position: "asc" }, include: { _count: { select: { questions: true } } } },
    },
  });
  return testPackage;
}

const dateFormat = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "Asia/Jakarta" });

export default async function LandingPage() {
  const [testPackage, session] = await Promise.all([getActivePackageSummary(), getParticipantSession()]);
  const history = session ? await listAttemptsForSession(session.id) : [];

  const unfinished = history.find((a) => a.status === "CREATED" || a.status === "IN_PROGRESS");
  const finished = history.filter((a) => a.status === "COMPLETED");
  const totalMinutes = testPackage
    ? Math.round(testPackage.sections.reduce((sum, s) => sum + s.durationSeconds, 0) / 60)
    : null;

  return (
    <main className="container py-5" style={{ maxWidth: 720 }}>
      <div className="text-center mb-4">
        <div className="d-flex justify-content-center mb-3">
          <ThunderMark size={64} id="landing" />
        </div>
        <div className="tp-eyebrow mb-1">Thunder Test Center</div>
        <h1 className="tp-brand display-6">TOEFL PREDICTION TEST</h1>
        <p className="text-muted mt-2 mb-0">
          Latihan tes TOEFL secara online. Skor langsung keluar begitu Anda selesai.
        </p>
      </div>

      {unfinished && (
        <div className="tp-card p-4 mb-4 border-primary" style={{ borderWidth: 2 }}>
          <h2 className="h5 mb-1">Tes Anda belum selesai</h2>
          <p className="text-muted small mb-3">
            Dimulai {dateFormat.format(unfinished.startedAt)} atas nama{" "}
            <strong>{unfinished.participantNameSnapshot}</strong>. Jawaban yang sudah Anda isi tetap
            tersimpan.
          </p>
          <Link href={`/test/${unfinished.publicCode}/instructions`} className="btn tp-btn-primary btn-lg w-100">
            Lanjutkan Tes
          </Link>
        </div>
      )}

      {testPackage && (
        <div className="tp-card p-4 mb-4">
          <h2 className="h6 mb-3">Tes ini terdiri dari 3 bagian, dikerjakan berurutan</h2>
          <div className="row g-2 text-center">
            {testPackage.sections.map((section, i) => {
              const info = SECTION_INFO[section.type as SectionTypeValue];
              return (
                <div className="col-12 col-sm-4" key={section.id}>
                  <div className="border rounded-3 p-3 h-100">
                    <div className="small text-muted">Bagian {i + 1}</div>
                    <div className="fw-bold text-primary">{info?.short ?? section.type}</div>
                    <div className="small text-muted mb-1">{info?.what}</div>
                    <div className="small fw-semibold">
                      {section._count.questions} soal · {formatMinutes(section.durationSeconds)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {totalMinutes && (
            <p className="small text-muted text-center mt-3 mb-0">
              Total waktu sekitar <strong>{totalMinutes} menit</strong>. Waktu tiap bagian berjalan
              sendiri-sendiri.
            </p>
          )}
        </div>
      )}

      <div className="tp-card p-4 p-md-5 mb-4">
        <h2 className="h5 mb-3">{unfinished ? "Atau mulai tes baru" : "Mulai tes"}</h2>
        <StartTestForm defaultName={session?.displayName ?? ""} />

        <div className="tp-note small mt-4">
          <div className="fw-semibold mb-1">Sebelum mulai, siapkan:</div>
          <ul className="mb-2 ps-3">
            <li>Headset atau speaker (bagian Listening memakai audio)</li>
            <li>Internet yang stabil</li>
            <li>Waktu luang ± 2 jam tanpa gangguan</li>
          </ul>
          <div className="text-muted">
            Jawaban tersimpan otomatis. Kalau halaman tidak sengaja tertutup, buka lagi website ini
            di HP/laptop yang sama, lalu tekan <strong>Lanjutkan Tes</strong>.
          </div>
        </div>
      </div>

      {finished.length > 0 && (
        <div className="tp-card p-4 mb-4">
          <h2 className="h6 mb-3">Hasil tes Anda sebelumnya</h2>
          <ul className="list-unstyled mb-0">
            {finished.map((attempt) => (
              <li
                key={attempt.id}
                className="d-flex justify-content-between align-items-center gap-2 py-2 border-bottom"
              >
                <div>
                  <div className="fw-semibold">Skor {attempt.overallScore ?? "—"}</div>
                  <div className="small text-muted">{dateFormat.format(attempt.startedAt)}</div>
                </div>
                <Link href={`/result/${attempt.publicCode}`} className="btn btn-sm btn-outline-primary">
                  Lihat hasil
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-center small mb-4">
        Sudah memesan sertifikat? <Link href="/klaim">Buka dengan kode klaim</Link>
      </p>

      <Disclaimer />
    </main>
  );
}
