import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { updateSection, updateTestPackageDetails, updateConversionTable } from "@/app/admin/actions";
import { isSupabaseConfigured } from "@/lib/audioStorage";
import { SECTION_INFO } from "@/lib/sectionLabels";
import type { SectionType } from "@/generated/prisma/client";
import { ActionForm } from "@/components/admin/ActionForm";
import { AudioUploader } from "@/components/admin/AudioUploader";
import { LineIcon, SECTION_ICON } from "@/components/LineIcon";

export default async function AdminTestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const testPackage = await prisma.testPackage.findUnique({
    where: { id },
    include: {
      sections: {
        orderBy: { position: "asc" },
        include: { _count: { select: { questions: { where: { isActive: true } } } } },
      },
      conversionRules: true,
    },
  });
  if (!testPackage) notFound();

  const storageReady = isSupabaseConfigured();

  const rulesBySection = new Map<SectionType, { rawScore: number; scaledScore: number }[]>();
  for (const rule of testPackage.conversionRules) {
    const list = rulesBySection.get(rule.sectionType) ?? [];
    list.push({ rawScore: rule.rawScore, scaledScore: rule.scaledScore });
    rulesBySection.set(rule.sectionType, list);
  }

  return (
    <>
      <Link href="/admin/tests" className="small fw-semibold text-decoration-none d-inline-flex align-items-center gap-1 mb-3">
        <LineIcon name="arrowLeft" size={14} /> Paket Soal
      </Link>

      <div className="adm-head">
        <div>
          <h1>{testPackage.name}</h1>
          <p>Perubahan berlaku untuk peserta yang memulai bagian tersebut setelah disimpan.</p>
        </div>
        <span className={`badge rounded-pill fs-6 ${testPackage.isActive ? "text-bg-success" : "text-bg-secondary"}`}>
          {testPackage.isActive ? "Aktif" : "Nonaktif"}
        </span>
      </div>

      <div className="tp-card p-4 mb-4">
        <h2 className="h6 mb-3">Info paket</h2>
        <ActionForm action={updateTestPackageDetails.bind(null, testPackage.id)} submitLabel="Simpan info paket">
          <div className="row g-3">
            <div className="col-md-6">
              <label className="form-label fw-semibold small" htmlFor="pkg-name">
                Nama paket
              </label>
              <input id="pkg-name" type="text" name="name" defaultValue={testPackage.name} className="form-control" required />
              <div className="form-text">Hanya terlihat oleh admin.</div>
            </div>
            <div className="col-md-6">
              <label className="form-label fw-semibold small" htmlFor="pkg-min">
                Skor minimum untuk boleh memesan sertifikat
              </label>
              <input
                id="pkg-min"
                type="number"
                name="certificateMinScore"
                defaultValue={testPackage.certificateMinScore ?? ""}
                placeholder="Kosong = semua skor boleh"
                className="form-control"
              />
              <div className="form-text">Kosongkan bila semua peserta boleh memesan sertifikat.</div>
            </div>
          </div>
        </ActionForm>
      </div>

      {testPackage.sections.map((section) => {
        const info = SECTION_INFO[section.type];
        const rules = (rulesBySection.get(section.type) ?? []).sort((a, b) => a.rawScore - b.rawScore);
        const tableJson = JSON.stringify(Object.fromEntries(rules.map((r) => [r.rawScore, r.scaledScore])));

        return (
          <div className="tp-card p-4 mb-4" key={section.id}>
            <div className="d-flex align-items-center gap-3 mb-3">
              <div className="tp-icon-chip">
                <LineIcon name={SECTION_ICON[section.type]} />
              </div>
              <div>
                <h2 className="h5 mb-0">{info.name}</h2>
                <div className="small text-muted">{section._count.questions} soal</div>
              </div>
            </div>

            <ActionForm action={updateSection.bind(null, section.id)} submitLabel={`Simpan bagian ${info.short}`}>
              <div className="row g-3">
                <div className="col-6 col-md-3">
                  <label className="form-label fw-semibold small" htmlFor={`dur-${section.id}`}>
                    Waktu (menit)
                  </label>
                  <input
                    id={`dur-${section.id}`}
                    type="number"
                    name="durationMinutes"
                    defaultValue={section.durationSeconds / 60}
                    step="0.5"
                    min="1"
                    className="form-control"
                    required
                  />
                </div>
                {section.type === "LISTENING" && (
                  <div className="col-6 col-md-3">
                    <label className="form-label fw-semibold small" htmlFor={`plays-${section.id}`}>
                      Audio boleh diputar
                    </label>
                    <div className="input-group">
                      <input
                        id={`plays-${section.id}`}
                        type="number"
                        name="audioMaxPlays"
                        defaultValue={section.audioMaxPlays}
                        min="1"
                        step="1"
                        className="form-control"
                        style={{ borderRadius: "14px 0 0 14px" }}
                        required
                      />
                      <span className="input-group-text" style={{ borderRadius: "0 14px 14px 0" }}>
                        kali
                      </span>
                    </div>
                  </div>
                )}
                <div className="col-12">
                  <label className="form-label fw-semibold small" htmlFor={`ins-${section.id}`}>
                    Petunjuk untuk peserta
                  </label>
                  <textarea
                    id={`ins-${section.id}`}
                    name="instructions"
                    defaultValue={section.instructions}
                    className="form-control"
                    rows={5}
                    required
                  />
                  <div className="form-text">Ditampilkan sebelum peserta menekan tombol mulai bagian ini.</div>
                </div>
              </div>
            </ActionForm>

            {section.type === "LISTENING" && (
              <div className="tp-note mt-4">
                <div className="fw-bold text-dark mb-1">Audio Listening</div>
                <div className="small text-muted mb-3">
                  File yang dipakai sekarang:{" "}
                  <span className="font-monospace text-dark">{section.audioAssetKey ?? "belum ada"}</span>
                </div>
                {storageReady ? (
                  <AudioUploader sectionId={section.id} />
                ) : (
                  <div className="small text-danger">
                    Penyimpanan audio belum diatur, jadi audio belum bisa diganti dari sini. Hubungi pengelola teknis.
                  </div>
                )}
              </div>
            )}

            <details className="mt-4">
              <summary className="small fw-semibold text-muted" style={{ cursor: "pointer" }}>
                Lanjutan: tabel konversi skor (jarang perlu diubah)
              </summary>
              <p className="small text-muted mt-2 mb-2">
                Mengubah jumlah jawaban benar menjadi skor {info.short}. Formatnya{" "}
                <code>{'{"jumlah_benar": skor}'}</code>, misalnya <code>{'{"0": 24, "1": 25}'}</code>. Salah ketik di sini
                akan memengaruhi skor peserta berikutnya — ubah hanya bila Anda yakin.
              </p>
              <ActionForm
                action={updateConversionTable.bind(null, testPackage.id, section.type)}
                submitLabel="Simpan tabel konversi"
                submitClassName="btn tp-btn-ghost"
                confirmText={`Ganti seluruh tabel konversi ${info.short}? Skor peserta berikutnya dihitung dengan tabel baru.`}
              >
                <textarea name="table" defaultValue={tableJson} className="form-control font-monospace small" rows={4} />
              </ActionForm>
            </details>
          </div>
        );
      })}
    </>
  );
}
