import Link from "next/link";
import { prisma } from "@/lib/db";
import { toggleTestPackageActive } from "@/app/admin/actions";
import { SECTION_INFO, formatMinutes } from "@/lib/sectionLabels";
import { ActionForm } from "@/components/admin/ActionForm";
import { LineIcon, SECTION_ICON } from "@/components/LineIcon";

export default async function AdminTestsPage() {
  const packages = await prisma.testPackage.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      sections: {
        orderBy: { position: "asc" },
        select: { id: true, type: true, durationSeconds: true, _count: { select: { questions: true } } },
      },
      _count: { select: { attempts: true } },
    },
  });

  return (
    <>
      <div className="adm-head">
        <div>
          <h1>Paket Soal</h1>
          <p>
            Atur waktu, petunjuk, dan audio tiap bagian tes. Jika ada lebih dari satu paket aktif, peserta
            mendapat salah satunya secara acak.
          </p>
        </div>
      </div>

      <div className="row g-3">
        {packages.map((pkg) => (
          <div className="col-xl-6" key={pkg.id}>
            <div className={`tp-card p-4 h-100 ${pkg.isActive ? "tp-card-accent" : ""}`} style={pkg.isActive ? undefined : { opacity: 0.75 }}>
              <div className="d-flex justify-content-between align-items-start gap-2 mb-3">
                <div>
                  <div className="fw-bold fs-5 text-dark">{pkg.name}</div>
                  <div className="small text-muted">{pkg._count.attempts} kali dikerjakan</div>
                </div>
                <span className={`badge rounded-pill ${pkg.isActive ? "text-bg-success" : "text-bg-secondary"}`}>
                  {pkg.isActive ? "Aktif" : "Nonaktif"}
                </span>
              </div>

              <div className="d-flex flex-column gap-2 mb-4">
                {pkg.sections.map((s) => (
                  <div key={s.id} className="d-flex align-items-center gap-2 small">
                    <LineIcon name={SECTION_ICON[s.type]} size={18} className="text-primary" />
                    <span className="fw-semibold text-dark flex-grow-1">{SECTION_INFO[s.type].short}</span>
                    <span className="text-muted">
                      {s._count.questions} soal · {formatMinutes(s.durationSeconds)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="d-flex gap-2 align-items-center flex-wrap">
                <Link href={`/admin/tests/${pkg.id}`} className="btn tp-btn-primary">
                  Atur paket ini
                </Link>
                <ActionForm
                  inline
                  action={toggleTestPackageActive.bind(null, pkg.id, !pkg.isActive)}
                  submitLabel={pkg.isActive ? "Nonaktifkan" : "Aktifkan"}
                  submitClassName="btn tp-btn-ghost"
                  confirmText={
                    pkg.isActive
                      ? `Nonaktifkan "${pkg.name}"? Peserta baru tidak akan mendapat paket ini.`
                      : undefined
                  }
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
