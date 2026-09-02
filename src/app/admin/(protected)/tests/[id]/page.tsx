import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import {
  updateSection,
  updateTestPackageDetails,
  updateConversionTable,
  uploadListeningAudioAction,
} from "@/app/admin/actions";
import type { SectionType } from "@/generated/prisma/client";

const SECTION_LABEL: Record<SectionType, string> = {
  LISTENING: "Listening Comprehension",
  STRUCTURE: "Structure & Written Expression",
  READING: "Reading Comprehension",
};

export default async function AdminTestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const testPackage = await prisma.testPackage.findUnique({
    where: { id },
    include: {
      sections: {
        orderBy: { position: "asc" },
        include: { _count: { select: { questions: true } } },
      },
      conversionRules: true,
    },
  });
  if (!testPackage) notFound();

  const supabaseConfigured = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY);

  const rulesBySection = new Map<SectionType, { rawScore: number; scaledScore: number }[]>();
  for (const rule of testPackage.conversionRules) {
    const list = rulesBySection.get(rule.sectionType) ?? [];
    list.push({ rawScore: rule.rawScore, scaledScore: rule.scaledScore });
    rulesBySection.set(rule.sectionType, list);
  }

  return (
    <div className="pagetitle mb-4">
      <h1>{testPackage.name}</h1>
      <div className="text-muted small font-monospace mb-3">{testPackage.code}</div>

      <div className="card mb-3">
        <div className="card-body">
          <h5 className="card-title">Detail Paket</h5>
          <form action={updateTestPackageDetails.bind(null, testPackage.id)}>
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label small">Nama Paket</label>
                <input type="text" name="name" defaultValue={testPackage.name} className="form-control" required />
              </div>
              <div className="col-md-3">
                <label className="form-label small">Skor Minimum Sertifikat</label>
                <input
                  type="number"
                  name="certificateMinScore"
                  defaultValue={testPackage.certificateMinScore ?? ""}
                  placeholder="Kosongkan = tanpa batas"
                  className="form-control"
                />
              </div>
              <div className="col-12">
                <label className="form-label small">Deskripsi</label>
                <textarea
                  name="description"
                  defaultValue={testPackage.description ?? ""}
                  className="form-control"
                  rows={2}
                />
              </div>
            </div>
            <button type="submit" className="btn tp-btn-primary btn-sm mt-3">
              Simpan
            </button>
          </form>
        </div>
      </div>

      {testPackage.sections.map((section) => {
        const rules = (rulesBySection.get(section.type) ?? []).sort((a, b) => a.rawScore - b.rawScore);
        const tableJson = JSON.stringify(
          Object.fromEntries(rules.map((r) => [r.rawScore, r.scaledScore])),
          null,
          0,
        );

        return (
          <div className="card mb-3" key={section.id}>
            <div className="card-body">
              <h5 className="card-title">
                {SECTION_LABEL[section.type]} <span className="text-muted small">({section._count.questions} soal)</span>
              </h5>

              <form action={updateSection.bind(null, section.id)} className="mb-4">
                <div className="row g-3">
                  <div className="col-md-3">
                    <label className="form-label small">Durasi (menit)</label>
                    <input
                      type="number"
                      name="durationMinutes"
                      defaultValue={section.durationSeconds / 60}
                      step="0.5"
                      min="1"
                      className="form-control"
                      required
                    />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label small">Maks. pemutaran audio</label>
                    <input
                      type="number"
                      name="audioMaxPlays"
                      defaultValue={section.audioMaxPlays}
                      min="1"
                      step="1"
                      className="form-control"
                      required
                      // readOnly, bukan disabled: input yang disabled tidak ikut
                      // terkirim di FormData sehingga nilainya jadi NaN di server.
                      readOnly={section.type !== "LISTENING"}
                    />
                    <div className="form-text">Hanya berlaku untuk Listening.</div>
                  </div>
                  <div className="col-md-3 d-flex align-items-start pt-4">
                    <div className="form-check">
                      <input
                        type="checkbox"
                        name="strictAudio"
                        id={`strict-${section.id}`}
                        defaultChecked={section.strictAudio}
                        className="form-check-input"
                      />
                      <label className="form-check-label small" htmlFor={`strict-${section.id}`}>
                        Mode ketat audio (tanpa seek/kendali kecepatan)
                      </label>
                    </div>
                  </div>
                  <div className="col-12">
                    <label className="form-label small">Instruksi</label>
                    <textarea
                      name="instructions"
                      defaultValue={section.instructions}
                      className="form-control"
                      rows={4}
                      required
                    />
                  </div>
                </div>
                <button type="submit" className="btn tp-btn-primary btn-sm mt-3">
                  Simpan Bagian
                </button>
              </form>

              {section.type === "LISTENING" && (
                <div className="mb-4 p-3 bg-light rounded">
                  <h6 className="mb-2">Audio Listening</h6>
                  <div className="small text-muted mb-2">
                    File saat ini: <span className="font-monospace">{section.audioAssetKey ?? "belum diatur"}</span>
                  </div>
                  {supabaseConfigured ? (
                    <form action={uploadListeningAudioAction.bind(null, section.id)} className="d-flex gap-2 align-items-center flex-wrap">
                      <input type="file" name="audio" accept="audio/mpeg,.mp3" className="form-control form-control-sm" style={{ maxWidth: 320 }} required />
                      <button type="submit" className="btn btn-outline-primary btn-sm">
                        Unggah / Ganti Audio
                      </button>
                    </form>
                  ) : (
                    <div className="alert alert-warning small mb-0 py-2">
                      Supabase Storage belum dikonfigurasi (SUPABASE_URL/SUPABASE_SECRET_KEY di
                      .env). Untuk sekarang, kelola audio lewat{" "}
                      <code>npx tsx scripts/upload-audio.ts {"<folder>"}</code> atau file lokal di{" "}
                      <code>content/</code>.
                    </div>
                  )}
                </div>
              )}

              <details>
                <summary className="small text-muted" style={{ cursor: "pointer" }}>
                  Tabel konversi raw → scaled ({rules.length} baris) — klik untuk edit
                </summary>
                <form action={updateConversionTable.bind(null, testPackage.id, section.type)} className="mt-2">
                  <textarea
                    name="table"
                    defaultValue={tableJson}
                    className="form-control font-monospace small"
                    rows={4}
                  />
                  <div className="form-text">
                    Format JSON: {"{"}"raw_score": scaled_score, ...{"}"}. Menimpa seluruh tabel section ini.
                  </div>
                  <button type="submit" className="btn btn-outline-primary btn-sm mt-2">
                    Simpan Tabel Konversi
                  </button>
                </form>
              </details>
            </div>
          </div>
        );
      })}
    </div>
  );
}
