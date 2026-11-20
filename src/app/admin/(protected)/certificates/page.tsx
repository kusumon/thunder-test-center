import Link from "next/link";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { setCertificateStatus } from "@/app/admin/actions";
import { CERT_STATUS, formatDate } from "@/lib/adminLabels";
import { ActionForm } from "@/components/admin/ActionForm";

export default async function AdminCertificatesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const params = await searchParams;

  const where: Prisma.CertificateWhereInput = {};
  if (params.q) {
    where.OR = [
      { certificateNumber: { contains: params.q.trim(), mode: "insensitive" } },
      { attempt: { participantNameSnapshot: { contains: params.q.trim(), mode: "insensitive" } } },
    ];
  }
  if (params.status === "valid") where.status = "VALID";
  if (params.status === "revoked") where.status = "REVOKED";

  const certificates = await prisma.certificate.findMany({
    where,
    orderBy: { issuedAt: "desc" },
    take: 100,
    include: {
      attempt: {
        select: {
          id: true,
          participantNameSnapshot: true,
          overallScore: true,
          certificateOrder: { select: { claimCode: true } },
        },
      },
    },
  });

  return (
    <>
      <div className="adm-head">
        <div>
          <h1>Sertifikat</h1>
          <p>Sertifikat terbit otomatis saat pembayaran disetujui. Di sini Anda bisa mencabutnya bila perlu.</p>
        </div>
      </div>

      <form className="tp-card p-3 mb-3" method="get">
        <div className="row g-2 align-items-end">
          <div className="col-md-5">
            <label className="adm-label mb-1" htmlFor="q">
              Cari nama atau nomor sertifikat
            </label>
            <input id="q" type="search" name="q" defaultValue={params.q} className="form-control" />
          </div>
          <div className="col-6 col-md-3">
            <label className="adm-label mb-1" htmlFor="status">
              Status
            </label>
            <select id="status" name="status" defaultValue={params.status ?? ""} className="form-select">
              <option value="">Semua</option>
              <option value="valid">Berlaku</option>
              <option value="revoked">Dicabut</option>
            </select>
          </div>
          <div className="col-6 col-md-2 d-flex gap-2">
            <button type="submit" className="btn tp-btn-primary flex-fill">
              Cari
            </button>
            {(params.q || params.status) && (
              <Link href="/admin/certificates" className="btn tp-btn-ghost" title="Hapus filter">
                ✕
              </Link>
            )}
          </div>
        </div>
      </form>

      <div className="tp-card p-3 p-md-4">
        <div className="table-responsive">
          <table className="table adm-table">
            <thead>
              <tr>
                <th>Peserta</th>
                <th>No. sertifikat</th>
                <th className="text-end">Skor</th>
                <th>Terbit</th>
                <th>Status</th>
                <th className="text-end">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {certificates.map((cert) => {
                const claimCode = cert.attempt.certificateOrder?.claimCode;
                const valid = cert.status === "VALID";
                return (
                  <tr key={cert.id}>
                    <td>
                      <Link href={`/admin/results/${cert.attempt.id}`} className="fw-semibold text-decoration-none">
                        {cert.attempt.participantNameSnapshot}
                      </Link>
                    </td>
                    <td>
                      <a
                        href={`/verify/${cert.certificateNumber}`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-monospace small text-decoration-none text-nowrap"
                        title="Buka halaman verifikasi publik"
                      >
                        {cert.certificateNumber} ↗
                      </a>
                    </td>
                    <td className="text-end fw-bold text-dark">{cert.attempt.overallScore ?? "—"}</td>
                    <td className="small text-nowrap">{formatDate(cert.issuedAt)}</td>
                    <td>
                      <span className={`badge rounded-pill ${CERT_STATUS[cert.status].badge}`}>
                        {CERT_STATUS[cert.status].label}
                      </span>
                    </td>
                    <td className="text-end">
                      <div className="d-inline-flex gap-2 align-items-center">
                        {claimCode && valid && (
                          <a
                            href={`/api/sertifikat/${claimCode}/pdf`}
                            className="btn btn-sm tp-btn-ghost text-nowrap"
                            title="Unduh PDF sertifikat"
                          >
                            Unduh PDF
                          </a>
                        )}
                        <ActionForm
                          inline
                          action={setCertificateStatus.bind(null, cert.id, valid ? "REVOKED" : "VALID")}
                          submitLabel={valid ? "Cabut" : "Berlakukan lagi"}
                          submitClassName={`btn btn-sm ${valid ? "btn-outline-danger" : "btn-outline-success"} rounded-pill`}
                          confirmText={
                            valid
                              ? `Cabut sertifikat ${cert.certificateNumber}? Halaman verifikasi akan menampilkan DICABUT dan peserta tidak bisa mengunduhnya lagi.`
                              : undefined
                          }
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
              {certificates.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-muted py-5">
                    Belum ada sertifikat yang cocok.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
