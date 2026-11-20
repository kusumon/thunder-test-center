import Link from "next/link";
import { prisma } from "@/lib/db";
import { startOfTodayJakarta } from "@/lib/date";
import type { Prisma } from "@/generated/prisma/client";
import { ATTEMPT_STATUS, CERT_STATUS, formatDateTime } from "@/lib/adminLabels";
import { LineIcon } from "@/components/LineIcon";

const PAGE_SIZE = 25;
const DAY_MS = 24 * 60 * 60 * 1000;

type SearchParams = {
  q?: string;
  status?: string;
  period?: string;
  cert?: string;
  packageId?: string;
  page?: string;
};

function buildWhere(params: SearchParams): Prisma.AttemptWhereInput {
  const where: Prisma.AttemptWhereInput = {};

  if (params.q) where.participantNameSnapshot = { contains: params.q.trim(), mode: "insensitive" };
  if (params.status === "done") where.status = "COMPLETED";
  if (params.status === "unfinished") where.status = { in: ["CREATED", "IN_PROGRESS"] };

  // Periode dihitung dari tengah malam WIB, bukan UTC.
  const today = startOfTodayJakarta();
  if (params.period === "today") where.startedAt = { gte: today };
  if (params.period === "7d") where.startedAt = { gte: new Date(today.getTime() - 6 * DAY_MS) };
  if (params.period === "30d") where.startedAt = { gte: new Date(today.getTime() - 29 * DAY_MS) };

  if (params.cert === "yes") where.certificate = { isNot: null };
  if (params.cert === "no") where.certificate = null;
  if (params.packageId) where.testPackageId = params.packageId;

  return where;
}

export default async function AdminResultsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const where = buildWhere(params);
  const filtered = Boolean(params.q || params.status || params.period || params.cert || params.packageId);

  const [attempts, total, testPackages] = await Promise.all([
    prisma.attempt.findMany({
      where,
      orderBy: { startedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { certificate: { select: { status: true } } },
    }),
    prisma.attempt.count({ where }),
    prisma.testPackage.findMany({ select: { id: true, name: true } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <div className="adm-head">
        <div>
          <h1>Peserta &amp; Skor</h1>
          <p>Semua orang yang pernah memulai tes. Tekan nama untuk melihat detail jawabannya.</p>
        </div>
      </div>

      <form className="tp-card p-3 mb-3" method="get">
        <div className="row g-2 align-items-end">
          <div className="col-md-4">
            <label className="adm-label mb-1" htmlFor="q">
              Cari nama
            </label>
            <input id="q" type="search" name="q" defaultValue={params.q} className="form-control" placeholder="Ketik nama peserta" />
          </div>
          <div className="col-6 col-md-2">
            <label className="adm-label mb-1" htmlFor="status">
              Status
            </label>
            <select id="status" name="status" defaultValue={params.status ?? ""} className="form-select">
              <option value="">Semua</option>
              <option value="done">Selesai</option>
              <option value="unfinished">Belum selesai</option>
            </select>
          </div>
          <div className="col-6 col-md-2">
            <label className="adm-label mb-1" htmlFor="period">
              Waktu
            </label>
            <select id="period" name="period" defaultValue={params.period ?? ""} className="form-select">
              <option value="">Semua</option>
              <option value="today">Hari ini</option>
              <option value="7d">7 hari terakhir</option>
              <option value="30d">30 hari terakhir</option>
            </select>
          </div>
          <div className="col-6 col-md-2">
            <label className="adm-label mb-1" htmlFor="cert">
              Sertifikat
            </label>
            <select id="cert" name="cert" defaultValue={params.cert ?? ""} className="form-select">
              <option value="">Semua</option>
              <option value="yes">Sudah punya</option>
              <option value="no">Belum punya</option>
            </select>
          </div>
          {testPackages.length > 1 && (
            <div className="col-6 col-md-2">
              <label className="adm-label mb-1" htmlFor="packageId">
                Paket
              </label>
              <select id="packageId" name="packageId" defaultValue={params.packageId ?? ""} className="form-select">
                <option value="">Semua</option>
                {testPackages.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="col-6 col-md-2 d-flex gap-2">
            <button type="submit" className="btn tp-btn-primary flex-fill">
              Cari
            </button>
            {filtered && (
              <Link href="/admin/results" className="btn tp-btn-ghost" title="Hapus filter">
                ✕
              </Link>
            )}
          </div>
        </div>
      </form>

      <div className="tp-card p-3 p-md-4">
        <div className="small text-muted mb-2">{total} peserta</div>
        <div className="table-responsive">
          <table className="table adm-table">
            <thead>
              <tr>
                <th>Peserta</th>
                <th>Status</th>
                <th className="text-end">Listening</th>
                <th className="text-end">Structure</th>
                <th className="text-end">Reading</th>
                <th className="text-end">Skor</th>
                <th>Sertifikat</th>
              </tr>
            </thead>
            <tbody>
              {attempts.map((a) => (
                <tr key={a.id}>
                  <td>
                    <Link href={`/admin/results/${a.id}`} className="fw-semibold text-decoration-none">
                      {a.participantNameSnapshot}
                    </Link>
                    <div className="small text-muted text-nowrap">{formatDateTime(a.startedAt)}</div>
                  </td>
                  <td>
                    <span className={`badge rounded-pill ${ATTEMPT_STATUS[a.status]?.badge}`}>
                      {ATTEMPT_STATUS[a.status]?.label ?? a.status}
                    </span>
                  </td>
                  <td className="text-end">{a.listeningScaled ?? "—"}</td>
                  <td className="text-end">{a.structureScaled ?? "—"}</td>
                  <td className="text-end">{a.readingScaled ?? "—"}</td>
                  <td className="text-end fw-bold text-dark fs-6">{a.overallScore ?? "—"}</td>
                  <td>
                    {a.certificate ? (
                      <span className={`badge rounded-pill ${CERT_STATUS[a.certificate.status].badge}`}>
                        {CERT_STATUS[a.certificate.status].label}
                      </span>
                    ) : (
                      <span className="text-muted small">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {attempts.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center text-muted py-5">
                    {filtered ? "Tidak ada peserta yang cocok dengan pencarian." : "Belum ada peserta."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="d-flex justify-content-between align-items-center mt-3">
            <span className="small text-muted">
              Halaman {page} dari {totalPages}
            </span>
            <div className="d-flex gap-2">
              {page > 1 && (
                <Link href={{ query: { ...params, page: String(page - 1) } }} className="btn btn-sm tp-btn-ghost">
                  <LineIcon name="arrowLeft" size={14} /> Sebelumnya
                </Link>
              )}
              {page < totalPages && (
                <Link href={{ query: { ...params, page: String(page + 1) } }} className="btn btn-sm tp-btn-ghost">
                  Selanjutnya <LineIcon name="arrowRight" size={14} />
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
