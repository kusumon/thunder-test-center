import Link from "next/link";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

const PAGE_SIZE = 25;

type SearchParams = {
  name?: string;
  dateFrom?: string;
  dateTo?: string;
  minScore?: string;
  maxScore?: string;
  packageId?: string;
  certStatus?: string;
  page?: string;
};

function buildWhere(params: SearchParams): Prisma.AttemptWhereInput {
  const where: Prisma.AttemptWhereInput = {};

  if (params.name) {
    where.participantNameSnapshot = { contains: params.name, mode: "insensitive" };
  }
  if (params.dateFrom || params.dateTo) {
    where.startedAt = {};
    if (params.dateFrom) where.startedAt.gte = new Date(`${params.dateFrom}T00:00:00`);
    if (params.dateTo) where.startedAt.lte = new Date(`${params.dateTo}T23:59:59.999`);
  }
  if (params.minScore || params.maxScore) {
    where.overallScore = {};
    if (params.minScore) where.overallScore.gte = Number(params.minScore);
    if (params.maxScore) where.overallScore.lte = Number(params.maxScore);
  }
  if (params.packageId) where.testPackageId = params.packageId;
  if (params.certStatus === "valid") where.certificate = { status: "VALID" };
  if (params.certStatus === "revoked") where.certificate = { status: "REVOKED" };
  if (params.certStatus === "none") where.certificate = null;

  return where;
}

export default async function AdminResultsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const where = buildWhere(params);

  const [attempts, total, testPackages] = await Promise.all([
    prisma.attempt.findMany({
      where,
      orderBy: { startedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { certificate: { select: { status: true, certificateNumber: true } } },
    }),
    prisma.attempt.count({ where }),
    prisma.testPackage.findMany({ select: { id: true, name: true } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="pagetitle mb-4">
      <h1>Hasil Tes</h1>

      <form className="card p-3 mb-3" method="get">
        <div className="row g-2 align-items-end">
          <div className="col-md-3">
            <label className="form-label small mb-1">Nama</label>
            <input type="text" name="name" defaultValue={params.name} className="form-control form-control-sm" />
          </div>
          <div className="col-md-2">
            <label className="form-label small mb-1">Dari Tanggal</label>
            <input type="date" name="dateFrom" defaultValue={params.dateFrom} className="form-control form-control-sm" />
          </div>
          <div className="col-md-2">
            <label className="form-label small mb-1">Sampai Tanggal</label>
            <input type="date" name="dateTo" defaultValue={params.dateTo} className="form-control form-control-sm" />
          </div>
          <div className="col-md-1">
            <label className="form-label small mb-1">Skor Min</label>
            <input type="number" name="minScore" defaultValue={params.minScore} className="form-control form-control-sm" />
          </div>
          <div className="col-md-1">
            <label className="form-label small mb-1">Skor Maks</label>
            <input type="number" name="maxScore" defaultValue={params.maxScore} className="form-control form-control-sm" />
          </div>
          <div className="col-md-2">
            <label className="form-label small mb-1">Paket</label>
            <select name="packageId" defaultValue={params.packageId ?? ""} className="form-select form-select-sm">
              <option value="">Semua</option>
              {testPackages.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="col-md-1">
            <label className="form-label small mb-1">Sertifikat</label>
            <select name="certStatus" defaultValue={params.certStatus ?? ""} className="form-select form-select-sm">
              <option value="">Semua</option>
              <option value="valid">Valid</option>
              <option value="revoked">Revoked</option>
              <option value="none">Belum ada</option>
            </select>
          </div>
        </div>
        <div className="mt-2">
          <button type="submit" className="btn btn-sm tp-btn-primary">
            Terapkan Filter
          </button>
          <Link href="/admin/results" className="btn btn-sm btn-outline-secondary ms-2">
            Reset
          </Link>
        </div>
      </form>

      <div className="card">
        <div className="card-body">
          <div className="text-muted small mb-2">{total} attempt ditemukan</div>
          <div className="table-responsive">
            <table className="table table-hover">
              <thead>
                <tr>
                  <th>Nama</th>
                  <th>Attempt</th>
                  <th>Tanggal</th>
                  <th className="text-end">L</th>
                  <th className="text-end">S</th>
                  <th className="text-end">R</th>
                  <th className="text-end">Total</th>
                  <th>Sertifikat</th>
                </tr>
              </thead>
              <tbody>
                {attempts.map((attempt) => (
                  <tr key={attempt.id}>
                    <td>
                      <Link href={`/admin/results/${attempt.id}`}>{attempt.participantNameSnapshot}</Link>
                    </td>
                    <td className="font-monospace small">{attempt.publicCode}</td>
                    <td className="small">
                      {new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(attempt.startedAt)}
                    </td>
                    <td className="text-end">{attempt.listeningScaled ?? "—"}</td>
                    <td className="text-end">{attempt.structureScaled ?? "—"}</td>
                    <td className="text-end">{attempt.readingScaled ?? "—"}</td>
                    <td className="text-end fw-semibold">{attempt.overallScore ?? "—"}</td>
                    <td>
                      {attempt.certificate ? (
                        <span
                          className={`badge ${attempt.certificate.status === "VALID" ? "bg-success" : "bg-danger"}`}
                        >
                          {attempt.certificate.status}
                        </span>
                      ) : (
                        <span className="text-muted small">—</span>
                      )}
                    </td>
                  </tr>
                ))}
                {attempts.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center text-muted py-4">
                      Tidak ada hasil yang cocok dengan filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="d-flex justify-content-between align-items-center mt-2">
              <span className="small text-muted">
                Halaman {page} dari {totalPages}
              </span>
              <div className="d-flex gap-2">
                {page > 1 && (
                  <Link
                    href={{ query: { ...params, page: String(page - 1) } }}
                    className="btn btn-sm btn-outline-secondary"
                  >
                    Sebelumnya
                  </Link>
                )}
                {page < totalPages && (
                  <Link
                    href={{ query: { ...params, page: String(page + 1) } }}
                    className="btn btn-sm btn-outline-secondary"
                  >
                    Selanjutnya
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
