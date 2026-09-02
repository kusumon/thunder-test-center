import Link from "next/link";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { setCertificateStatus } from "@/app/admin/actions";

export default async function AdminCertificatesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const params = await searchParams;

  const where: Prisma.CertificateWhereInput = {};
  if (params.q) {
    where.OR = [
      { certificateNumber: { contains: params.q, mode: "insensitive" } },
      { attempt: { participantNameSnapshot: { contains: params.q, mode: "insensitive" } } },
    ];
  }
  if (params.status === "valid") where.status = "VALID";
  if (params.status === "revoked") where.status = "REVOKED";

  const certificates = await prisma.certificate.findMany({
    where,
    orderBy: { issuedAt: "desc" },
    take: 100,
    include: { attempt: { select: { id: true, publicCode: true, participantNameSnapshot: true, overallScore: true } } },
  });

  return (
    <div className="pagetitle mb-4">
      <h1>Sertifikat</h1>

      <form className="card p-3 mb-3" method="get">
        <div className="row g-2 align-items-end">
          <div className="col-md-4">
            <label className="form-label small mb-1">Cari nomor sertifikat / nama</label>
            <input type="text" name="q" defaultValue={params.q} className="form-control form-control-sm" />
          </div>
          <div className="col-md-3">
            <label className="form-label small mb-1">Status</label>
            <select name="status" defaultValue={params.status ?? ""} className="form-select form-select-sm">
              <option value="">Semua</option>
              <option value="valid">Valid</option>
              <option value="revoked">Revoked</option>
            </select>
          </div>
          <div className="col-md-2">
            <button type="submit" className="btn btn-sm tp-btn-primary">
              Cari
            </button>
            <Link href="/admin/certificates" className="btn btn-sm btn-outline-secondary ms-2">
              Reset
            </Link>
          </div>
        </div>
      </form>

      <div className="card">
        <div className="card-body">
          <div className="table-responsive">
            <table className="table table-hover">
              <thead>
                <tr>
                  <th>Nomor Sertifikat</th>
                  <th>Peserta</th>
                  <th className="text-end">Skor</th>
                  <th>Diterbitkan</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {certificates.map((cert) => (
                  <tr key={cert.id}>
                    <td className="font-monospace small">
                      <a href={`/verify/${cert.certificateNumber}`} target="_blank" rel="noreferrer">
                        {cert.certificateNumber}
                      </a>
                    </td>
                    <td>
                      <Link href={`/admin/results/${cert.attempt.id}`}>{cert.attempt.participantNameSnapshot}</Link>
                    </td>
                    <td className="text-end">{cert.attempt.overallScore ?? "—"}</td>
                    <td className="small">
                      {new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(cert.issuedAt)}
                    </td>
                    <td>
                      <span className={`badge ${cert.status === "VALID" ? "bg-success" : "bg-danger"}`}>
                        {cert.status}
                      </span>
                    </td>
                    <td>
                      <form
                        action={setCertificateStatus.bind(
                          null,
                          cert.id,
                          cert.status === "VALID" ? "REVOKED" : "VALID",
                        )}
                      >
                        <button
                          type="submit"
                          className={`btn btn-sm ${cert.status === "VALID" ? "btn-outline-danger" : "btn-outline-success"}`}
                        >
                          {cert.status === "VALID" ? "Revoke" : "Aktifkan Lagi"}
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
                {certificates.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center text-muted py-4">
                      Tidak ada sertifikat yang cocok.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
