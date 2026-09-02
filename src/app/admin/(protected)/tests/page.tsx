import Link from "next/link";
import { prisma } from "@/lib/db";
import { toggleTestPackageActive } from "@/app/admin/actions";

export default async function AdminTestsPage() {
  const packages = await prisma.testPackage.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      sections: { select: { id: true, _count: { select: { questions: true } } } },
      _count: { select: { attempts: true } },
    },
  });

  return (
    <div className="pagetitle mb-4">
      <h1>Paket Tes</h1>

      <div className="card">
        <div className="card-body">
          <div className="table-responsive">
            <table className="table table-hover">
              <thead>
                <tr>
                  <th>Kode</th>
                  <th>Nama</th>
                  <th className="text-end">Total Soal</th>
                  <th className="text-end">Attempt</th>
                  <th>Skor Min. Sertifikat</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {packages.map((pkg) => {
                  const totalQuestions = pkg.sections.reduce((n, s) => n + s._count.questions, 0);
                  return (
                    <tr key={pkg.id}>
                      <td className="font-monospace small">{pkg.code}</td>
                      <td>
                        <Link href={`/admin/tests/${pkg.id}`}>{pkg.name}</Link>
                      </td>
                      <td className="text-end">{totalQuestions}</td>
                      <td className="text-end">{pkg._count.attempts}</td>
                      <td>{pkg.certificateMinScore ?? <span className="text-muted">tidak diwajibkan</span>}</td>
                      <td>
                        <span className={`badge ${pkg.isActive ? "bg-success" : "bg-secondary"}`}>
                          {pkg.isActive ? "Aktif" : "Nonaktif"}
                        </span>
                      </td>
                      <td>
                        <form action={toggleTestPackageActive.bind(null, pkg.id, !pkg.isActive)}>
                          <button type="submit" className="btn btn-sm btn-outline-secondary">
                            {pkg.isActive ? "Nonaktifkan" : "Aktifkan"}
                          </button>
                        </form>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
