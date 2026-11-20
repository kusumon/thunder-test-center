import Link from "next/link";
import { prisma } from "@/lib/db";
import { getParticipantSession } from "@/lib/session";
import { listAttemptsForSession, type SectionTypeValue } from "@/lib/attempts";
import { SECTION_INFO, formatMinutes } from "@/lib/sectionLabels";
import { StartTestForm } from "@/components/StartTestForm";
import { Disclaimer } from "@/components/Disclaimer";
import { ThunderMark } from "@/components/Brand";
import { LineIcon, SECTION_ICON } from "@/components/LineIcon";

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

const PREPARE = [
  { icon: "headphones", title: "Headset / speaker", text: "Bagian Listening memakai audio." },
  { icon: "wifi", title: "Internet stabil", text: "Jawaban disimpan otomatis ke server." },
  { icon: "clock", title: "Waktu ± 2 jam", text: "Cari tempat tenang tanpa gangguan." },
] as const;

const FLOW = ["Tulis nama Anda", "Kerjakan 3 bagian tes", "Skor langsung keluar", "Pesan sertifikat (opsional)"];

export default async function LandingPage() {
  const [testPackage, session] = await Promise.all([getActivePackageSummary(), getParticipantSession()]);
  const history = session ? await listAttemptsForSession(session.id) : [];

  const unfinished = history.find((a) => a.status === "CREATED" || a.status === "IN_PROGRESS");
  const finished = history.filter((a) => a.status === "COMPLETED");
  const totalMinutes = testPackage
    ? Math.round(testPackage.sections.reduce((sum, s) => sum + s.durationSeconds, 0) / 60)
    : null;
  const totalQuestions = testPackage?.sections.reduce((sum, s) => sum + s._count.questions, 0) ?? null;

  return (
    <main>
      {/* ---------- Hero ---------- */}
      <section className="tp-hero text-center">
        <div className="container" style={{ maxWidth: 760 }}>
          <div className="d-flex justify-content-center mb-3 tp-logo-glow">
            <ThunderMark size={72} id="landing" />
          </div>
          <div className="tp-eyebrow mb-3">Thunder Test Center</div>
          <h1 className="display-5 mb-3">
            TOEFL Prediction Test
          </h1>
          <p className="tp-hero-lead mx-auto mb-4" style={{ maxWidth: 560 }}>
            Simulasi tes TOEFL lengkap — Listening, Structure, dan Reading. Kerjakan langsung di
            browser, skor muncul begitu Anda selesai.
          </p>
          <div className="d-flex flex-wrap justify-content-center gap-2">
            {totalQuestions && (
              <span className="tp-hero-badge">
                <LineIcon name="book" size={15} /> {totalQuestions} soal
              </span>
            )}
            {totalMinutes && (
              <span className="tp-hero-badge">
                <LineIcon name="clock" size={15} /> ± {totalMinutes} menit
              </span>
            )}
            <span className="tp-hero-badge">
              <LineIcon name="zap" size={15} /> Skor instan
            </span>
          </div>
        </div>
      </section>

      <div className="container tp-overlap pb-5" style={{ maxWidth: 760 }}>
        {unfinished && (
          <div className="tp-card tp-card-accent p-4 mb-4 tp-rise">
            <div className="d-flex gap-3 align-items-start mb-3">
              <div className="tp-icon-chip">
                <LineIcon name="hourglass" />
              </div>
              <div>
                <h2 className="h5 mb-1">Tes Anda belum selesai</h2>
                <p className="text-muted small mb-0">
                  Dimulai {dateFormat.format(unfinished.startedAt)} atas nama{" "}
                  <strong>{unfinished.participantNameSnapshot}</strong>. Jawaban yang sudah diisi tetap
                  tersimpan.
                </p>
              </div>
            </div>
            <Link
              href={`/test/${unfinished.publicCode}/instructions`}
              className="btn tp-btn-primary btn-lg w-100 d-flex align-items-center justify-content-center gap-2"
            >
              Lanjutkan Tes <LineIcon name="arrowRight" size={20} />
            </Link>
          </div>
        )}

        {/* ---------- Formulir mulai ---------- */}
        <div className="tp-card tp-card-accent p-4 p-md-5 mb-4 tp-rise">
          <div className="d-flex gap-3 align-items-center mb-4">
            <div className="tp-icon-chip is-solid">
              <LineIcon name="user" />
            </div>
            <div>
              <h2 className="h4 mb-0">{unfinished ? "Atau mulai tes baru" : "Mulai tes sekarang"}</h2>
              <div className="small text-muted">Cukup tulis nama — tanpa daftar akun.</div>
            </div>
          </div>
          <StartTestForm defaultName={session?.displayName ?? ""} />
        </div>

        {/* ---------- Tiga bagian tes ---------- */}
        {testPackage && (
          <section className="mb-4">
            <h2 className="h5 mb-3 px-1">Isi tesnya</h2>
            <div className="row g-3">
              {testPackage.sections.map((section, i) => {
                const type = section.type as SectionTypeValue;
                const info = SECTION_INFO[type];
                return (
                  <div className="col-12 col-md-4" key={section.id}>
                    <div className="tp-card p-3 p-md-4 h-100 d-flex flex-md-column gap-3">
                      <div className="tp-icon-chip">
                        <LineIcon name={SECTION_ICON[type] ?? "book"} />
                      </div>
                      <div>
                        <div className="small fw-bold text-muted">Bagian {i + 1}</div>
                        <div className="fw-bold fs-5 text-dark lh-sm">{info?.short ?? section.type}</div>
                        <div className="small text-muted mb-2">{info?.what}</div>
                        <div className="d-flex flex-wrap gap-2">
                          <span className="tp-pill">{section._count.questions} soal</span>
                          <span className="tp-pill">{formatMinutes(section.durationSeconds)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ---------- Persiapan ---------- */}
        <section className="tp-card p-4 mb-4">
          <h2 className="h5 mb-3">Sebelum mulai, siapkan</h2>
          <div className="row g-3">
            {PREPARE.map((item) => (
              <div className="col-12 col-md-4" key={item.title}>
                <div className="d-flex gap-3 align-items-start">
                  <div className="tp-icon-chip is-sm">
                    <LineIcon name={item.icon} size={18} />
                  </div>
                  <div>
                    <div className="fw-semibold text-dark">{item.title}</div>
                    <div className="small text-muted">{item.text}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="tp-note small mt-4 d-flex gap-2">
            <LineIcon name="shield" size={18} className="text-primary" />
            <span>
              Jawaban tersimpan otomatis. Kalau halaman tidak sengaja tertutup, buka lagi website ini
              di HP/laptop yang sama, lalu tekan <strong>Lanjutkan Tes</strong>.
            </span>
          </div>
        </section>

        {/* ---------- Alur ---------- */}
        <section className="tp-card p-4 mb-4">
          <h2 className="h5 mb-3">Alurnya cuma begini</h2>
          <ol className="tp-steps">
            {FLOW.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </section>

        {finished.length > 0 && (
          <section className="tp-card p-4 mb-4">
            <h2 className="h5 mb-3">Hasil tes Anda sebelumnya</h2>
            <ul className="list-unstyled mb-0">
              {finished.map((attempt) => (
                <li
                  key={attempt.id}
                  className="d-flex justify-content-between align-items-center gap-2 py-2 border-bottom"
                >
                  <div className="d-flex align-items-center gap-3">
                    <div className="tp-icon-chip is-sm">
                      <LineIcon name="chart" size={18} />
                    </div>
                    <div>
                      <div className="fw-bold text-dark">Skor {attempt.overallScore ?? "—"}</div>
                      <div className="small text-muted">{dateFormat.format(attempt.startedAt)}</div>
                    </div>
                  </div>
                  <Link href={`/result/${attempt.publicCode}`} className="btn btn-sm tp-btn-ghost">
                    Lihat hasil
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <Link
          href="/klaim"
          className="tp-card p-3 mb-4 d-flex align-items-center gap-3 text-decoration-none"
        >
          <div className="tp-icon-chip is-sm">
            <LineIcon name="key" size={18} />
          </div>
          <div className="flex-grow-1">
            <div className="fw-semibold text-dark">Sudah memesan sertifikat?</div>
            <div className="small text-muted">Buka dengan kode klaim Anda</div>
          </div>
          <LineIcon name="arrowRight" size={18} className="text-primary" />
        </Link>

        <Disclaimer />
      </div>
    </main>
  );
}
