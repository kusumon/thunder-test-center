import Link from "next/link";
import { prisma } from "@/lib/db";
import { startOfTodayJakarta } from "@/lib/date";
import { SECTION_ORDER, type SectionTypeValue } from "@/lib/attempts";
import { Icon, type IconName } from "@/components/Icon";

async function getSummary() {
  const [
    totalAttempts,
    completedAttempts,
    scoreAgg,
    certificatesIssued,
    testsToday,
    recentAttempts,
    statusGroups,
    completionTimes,
    sectionSubmissions,
  ] = await Promise.all([
    prisma.attempt.count(),
    prisma.attempt.count({ where: { status: "COMPLETED" } }),
    prisma.attempt.aggregate({
      where: { status: "COMPLETED" },
      _avg: { overallScore: true },
      _max: { overallScore: true },
    }),
    prisma.certificate.count(),
    prisma.attempt.count({ where: { startedAt: { gte: startOfTodayJakarta() } } }),
    prisma.attempt.findMany({
      orderBy: { startedAt: "desc" },
      take: 8,
      select: {
        id: true,
        publicCode: true,
        participantNameSnapshot: true,
        status: true,
        overallScore: true,
        startedAt: true,
      },
    }),
    prisma.attempt.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.attempt.findMany({
      where: { status: "COMPLETED" },
      select: { startedAt: true, completedAt: true },
    }),
    // Drop-off per bagian: berapa attempt yang berhasil MENYELESAIKAN
    // masing-masing section (submittedAt terisi), digabung lintas semua
    // paket aktif (§19 — paket bisa lebih dari satu, tipe section sama).
    prisma.attemptSectionSession.findMany({
      where: { submittedAt: { not: null } },
      select: { section: { select: { type: true } } },
    }),
  ]);

  const statusCounts = Object.fromEntries(statusGroups.map((g) => [g.status, g._count._all]));

  const durationsMinutes = completionTimes
    .filter((a): a is { startedAt: Date; completedAt: Date } => a.completedAt !== null)
    .map((a) => (a.completedAt.getTime() - a.startedAt.getTime()) / 60000);
  const avgDurationMinutes =
    durationsMinutes.length > 0
      ? durationsMinutes.reduce((sum, m) => sum + m, 0) / durationsMinutes.length
      : null;

  const dropoffCounts: Record<SectionTypeValue, number> = { LISTENING: 0, STRUCTURE: 0, READING: 0 };
  for (const row of sectionSubmissions) {
    dropoffCounts[row.section.type] += 1;
  }

  return {
    totalAttempts,
    completedAttempts,
    averageScore: scoreAgg._avg.overallScore,
    highestScore: scoreAgg._max.overallScore,
    certificatesIssued,
    testsToday,
    recentAttempts,
    statusCounts,
    avgDurationMinutes,
    dropoffCounts,
  };
}

const CARD_ICON: Record<string, IconName> = {
  totalAttempts: "people",
  completedAttempts: "checkCircle",
  averageScore: "graphUp",
  highestScore: "trophy",
  certificatesIssued: "patchCheck",
  testsToday: "calendarCheck",
};

const SECTION_LABEL: Record<SectionTypeValue, string> = {
  LISTENING: "Listening",
  STRUCTURE: "Structure",
  READING: "Reading",
};

export default async function AdminDashboardPage() {
  const summary = await getSummary();

  const cards = [
    { key: "totalAttempts", label: "Total Attempts", value: summary.totalAttempts },
    { key: "completedAttempts", label: "Completed Attempts", value: summary.completedAttempts },
    {
      key: "averageScore",
      label: "Average Score",
      value: summary.averageScore ? Math.round(summary.averageScore) : "—",
    },
    { key: "highestScore", label: "Highest Score", value: summary.highestScore ?? "—" },
    { key: "certificatesIssued", label: "Certificates Issued", value: summary.certificatesIssued },
    { key: "testsToday", label: "Tests Today", value: summary.testsToday },
  ];

  const completionRate =
    summary.totalAttempts > 0 ? Math.round((summary.completedAttempts / summary.totalAttempts) * 100) : null;

  return (
    <div className="pagetitle mb-4">
      <h1>Dashboard</h1>

      <div className="row g-3 mt-1">
        {cards.map((card) => (
          <div className="col-md-4 col-xl-2" key={card.key}>
            <div className="card">
              <div className="card-body">
                <h6 className="card-title text-muted small mb-1">{card.label}</h6>
                <div className="d-flex align-items-center gap-2">
                  <Icon name={CARD_ICON[card.key]} size={22} />
                  <span className="fs-4 fw-bold">{card.value}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="row g-3 mt-1">
        <div className="col-lg-6">
          <div className="card h-100">
            <div className="card-body">
              <h5 className="card-title">Penyelesaian Tes</h5>
              <div className="d-flex align-items-baseline gap-2 mb-3">
                <span className="fs-3 fw-bold text-primary">
                  {completionRate !== null ? `${completionRate}%` : "—"}
                </span>
                <span className="text-muted small">attempt yang berhasil sampai selesai</span>
              </div>

              <table className="table table-sm table-borderless mb-2">
                <tbody>
                  <tr>
                    <td className="text-muted">Belum mulai bagian mana pun</td>
                    <td className="text-end fw-semibold">{summary.statusCounts.CREATED ?? 0}</td>
                  </tr>
                  <tr>
                    <td className="text-muted">Sedang berjalan</td>
                    <td className="text-end fw-semibold">{summary.statusCounts.IN_PROGRESS ?? 0}</td>
                  </tr>
                  <tr>
                    <td className="text-muted">Selesai</td>
                    <td className="text-end fw-semibold">{summary.statusCounts.COMPLETED ?? 0}</td>
                  </tr>
                </tbody>
              </table>

              <div className="small text-muted">
                Rata-rata durasi pengerjaan (yang selesai):{" "}
                <strong>
                  {summary.avgDurationMinutes !== null
                    ? `${Math.round(summary.avgDurationMinutes)} menit`
                    : "—"}
                </strong>
              </div>
            </div>
          </div>
        </div>

        <div className="col-lg-6">
          <div className="card h-100">
            <div className="card-body">
              <h5 className="card-title">Titik Berhenti Peserta</h5>
              <p className="text-muted small">
                Berapa attempt yang berhasil menyelesaikan tiap bagian — selisih besar antar bagian
                menandakan di situ peserta paling sering berhenti.
              </p>
              {SECTION_ORDER.map((type) => {
                const count = summary.dropoffCounts[type];
                const pct = summary.totalAttempts > 0 ? (count / summary.totalAttempts) * 100 : 0;
                return (
                  <div key={type} className="mb-2">
                    <div className="d-flex justify-content-between small mb-1">
                      <span>{SECTION_LABEL[type]}</span>
                      <span className="text-muted">{count} attempt</span>
                    </div>
                    <div className="progress" style={{ height: 6 }}>
                      <div
                        className="progress-bar"
                        role="progressbar"
                        style={{ width: `${pct}%` }}
                        aria-valuenow={pct}
                        aria-valuemin={0}
                        aria-valuemax={100}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="card mt-3">
        <div className="card-body">
          <h5 className="card-title">Attempt Terbaru</h5>
          <div className="table-responsive">
            <table className="table table-borderless datatable">
              <thead>
                <tr>
                  <th>Nama</th>
                  <th>Attempt</th>
                  <th>Tanggal</th>
                  <th>Status</th>
                  <th className="text-end">Skor</th>
                </tr>
              </thead>
              <tbody>
                {summary.recentAttempts.map((attempt) => (
                  <tr key={attempt.id}>
                    <td>{attempt.participantNameSnapshot}</td>
                    <td className="font-monospace small">
                      <Link href={`/admin/results/${attempt.id}`}>{attempt.publicCode}</Link>
                    </td>
                    <td className="small">
                      {new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(
                        attempt.startedAt,
                      )}
                    </td>
                    <td>
                      <span
                        className={`badge ${attempt.status === "COMPLETED" ? "bg-success" : "bg-secondary"}`}
                      >
                        {attempt.status}
                      </span>
                    </td>
                    <td className="text-end fw-semibold">{attempt.overallScore ?? "—"}</td>
                  </tr>
                ))}
                {summary.recentAttempts.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center text-muted py-4">
                      Belum ada attempt.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Link href="/admin/results" className="small">
            Lihat semua hasil &rarr;
          </Link>
        </div>
      </div>
    </div>
  );
}
