import Link from "next/link";
import { prisma } from "@/lib/db";
import { startOfTodayJakarta } from "@/lib/date";
import { SECTION_ORDER } from "@/lib/attempts";
import { SECTION_INFO } from "@/lib/sectionLabels";
import { formatRupiah } from "@/lib/settings";
import { ATTEMPT_STATUS, formatDateTime } from "@/lib/adminLabels";
import { LineIcon, type LineIconName } from "@/components/LineIcon";

async function getSummary() {
  const [
    pendingOrders,
    testsToday,
    totalAttempts,
    completedAttempts,
    scoreAgg,
    certificatesIssued,
    revenue,
    sectionSubmissions,
    recentAttempts,
  ] = await Promise.all([
    prisma.certificateOrder.count({ where: { status: "MENUNGGU_KONFIRMASI" } }),
    prisma.attempt.count({ where: { startedAt: { gte: startOfTodayJakarta() } } }),
    prisma.attempt.count(),
    prisma.attempt.count({ where: { status: "COMPLETED" } }),
    prisma.attempt.aggregate({ where: { status: "COMPLETED" }, _avg: { overallScore: true } }),
    prisma.certificate.count(),
    prisma.certificateOrder.aggregate({ where: { status: "DISETUJUI" }, _sum: { amount: true } }),
    // Berapa peserta yang menuntaskan tiap bagian — untuk melihat di mana mereka berhenti.
    prisma.attemptSectionSession.findMany({
      where: { submittedAt: { not: null } },
      select: { attemptId: true, section: { select: { type: true } } },
    }),
    prisma.attempt.findMany({
      orderBy: { startedAt: "desc" },
      take: 6,
      select: { id: true, participantNameSnapshot: true, status: true, overallScore: true, startedAt: true },
    }),
  ]);

  // Tes yang sudah dapat skor pasti menuntaskan semua bagian — dihitung juga,
  // supaya angka tidak bertentangan untuk data lama yang catatan per-bagiannya
  // tidak lengkap.
  const completedIds = await prisma.attempt.findMany({ where: { status: "COMPLETED" }, select: { id: true } });
  const finishedSets = { LISTENING: new Set<string>(), STRUCTURE: new Set<string>(), READING: new Set<string>() };
  for (const row of sectionSubmissions) finishedSets[row.section.type].add(row.attemptId);
  for (const { id } of completedIds) {
    finishedSets.LISTENING.add(id);
    finishedSets.STRUCTURE.add(id);
    finishedSets.READING.add(id);
  }
  const finishedPerSection = {
    LISTENING: finishedSets.LISTENING.size,
    STRUCTURE: finishedSets.STRUCTURE.size,
    READING: finishedSets.READING.size,
  };

  return {
    pendingOrders,
    testsToday,
    totalAttempts,
    completedAttempts,
    averageScore: scoreAgg._avg.overallScore,
    certificatesIssued,
    revenue: revenue._sum.amount ?? 0,
    finishedPerSection,
    recentAttempts,
  };
}

function Stat({ icon, value, label, sub }: { icon: LineIconName; value: string | number; label: string; sub?: string }) {
  return (
    <div className="tp-card p-3 p-md-4 h-100">
      <div className="adm-stat">
        <div className="tp-icon-chip">
          <LineIcon name={icon} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div className="adm-stat-value">{value}</div>
          <div className="adm-stat-label">{label}</div>
          {sub && <div className="small text-muted">{sub}</div>}
        </div>
      </div>
    </div>
  );
}

const todayLabel = () =>
  new Intl.DateTimeFormat("id-ID", { dateStyle: "full", timeZone: "Asia/Jakarta" }).format(new Date());

export default async function AdminDashboardPage() {
  const s = await getSummary();

  const funnel = [
    { label: "Mulai tes", count: s.totalAttempts },
    ...SECTION_ORDER.map((type) => ({ label: `Selesai ${SECTION_INFO[type].short}`, count: s.finishedPerSection[type] })),
    { label: "Kirim jawaban & dapat skor", count: s.completedAttempts },
  ];

  return (
    <>
      <div className="adm-head">
        <div>
          <h1>Ringkasan</h1>
          <p>{todayLabel()}</p>
        </div>
      </div>

      {/* Hal yang perlu ditindaklanjuti admin — paling atas. */}
      {s.pendingOrders > 0 ? (
        <Link
          href="/admin/orders"
          className="tp-card p-3 p-md-4 mb-4 d-flex align-items-center gap-3 text-decoration-none"
          style={{ background: "linear-gradient(135deg, #fffbeb, #fef3c7)", borderColor: "#fcd34d" }}
        >
          <div className="tp-icon-chip" style={{ background: "#f59e0b", color: "#fff", boxShadow: "none" }}>
            <LineIcon name="card" />
          </div>
          <div className="flex-grow-1">
            <div className="fw-bold text-dark fs-5">{s.pendingOrders} pembayaran menunggu dicek</div>
            <div className="small" style={{ color: "#92400e" }}>
              Peserta sudah transfer dan menunggu sertifikatnya. Cocokkan dengan mutasi rekening Anda.
            </div>
          </div>
          <span className="btn tp-btn-primary d-none d-sm-inline-flex align-items-center gap-2">
            Cek sekarang <LineIcon name="arrowRight" size={18} />
          </span>
        </Link>
      ) : (
        <div className="tp-note mb-4 d-flex align-items-center gap-2">
          <LineIcon name="check" size={18} className="text-success" strokeWidth={3} />
          <span>Tidak ada pembayaran yang perlu dicek saat ini.</span>
        </div>
      )}

      <div className="row g-3 mb-4">
        <div className="col-6 col-xl-3">
          <Stat icon="user" value={s.testsToday} label="Peserta hari ini" />
        </div>
        <div className="col-6 col-xl-3">
          <Stat
            icon="check"
            value={s.completedAttempts}
            label="Tes selesai"
            sub={`dari ${s.totalAttempts} yang dimulai`}
          />
        </div>
        <div className="col-6 col-xl-3">
          <Stat
            icon="chart"
            value={s.averageScore ? Math.round(s.averageScore) : "—"}
            label="Rata-rata skor"
          />
        </div>
        <div className="col-6 col-xl-3">
          <Stat
            icon="award"
            value={formatRupiah(s.revenue)}
            label="Pemasukan sertifikat"
            sub={`${s.certificatesIssued} sertifikat terbit`}
          />
        </div>
      </div>

      <div className="row g-3">
        <div className="col-lg-5">
          <div className="tp-card p-4 h-100">
            <h2 className="h6 mb-1">Peserta sampai di mana?</h2>
            <p className="small text-muted mb-3">
              Selisih besar antar baris menandakan banyak peserta berhenti di tahap itu.
            </p>
            {funnel.map((step) => {
              const pct = s.totalAttempts > 0 ? (step.count / s.totalAttempts) * 100 : 0;
              return (
                <div key={step.label} className="mb-3">
                  <div className="d-flex justify-content-between small mb-1">
                    <span className="fw-semibold text-dark">{step.label}</span>
                    <span className="text-muted">
                      {step.count} orang · {Math.round(pct)}%
                    </span>
                  </div>
                  <div className="tp-progress-line rounded-pill overflow-hidden" style={{ height: 8 }}>
                    <span style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="col-lg-7">
          <div className="tp-card p-4 h-100">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <h2 className="h6 mb-0">Peserta terbaru</h2>
              <Link href="/admin/results" className="small fw-semibold text-decoration-none">
                Lihat semua →
              </Link>
            </div>
            <div className="table-responsive">
              <table className="table adm-table">
                <tbody>
                  {s.recentAttempts.map((a) => (
                    <tr key={a.id}>
                      <td>
                        <Link href={`/admin/results/${a.id}`} className="fw-semibold text-decoration-none">
                          {a.participantNameSnapshot}
                        </Link>
                        <div className="small text-muted">{formatDateTime(a.startedAt)}</div>
                      </td>
                      <td>
                        <span className={`badge rounded-pill ${ATTEMPT_STATUS[a.status]?.badge}`}>
                          {ATTEMPT_STATUS[a.status]?.label ?? a.status}
                        </span>
                      </td>
                      <td className="text-end fw-bold text-dark">{a.overallScore ?? "—"}</td>
                    </tr>
                  ))}
                  {s.recentAttempts.length === 0 && (
                    <tr>
                      <td className="text-center text-muted py-4">Belum ada peserta.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
