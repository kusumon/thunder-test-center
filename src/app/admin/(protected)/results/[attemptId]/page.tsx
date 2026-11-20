import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatRupiah } from "@/lib/settings";
import { SECTION_INFO } from "@/lib/sectionLabels";
import { ATTEMPT_STATUS, CERT_STATUS, ORDER_STATUS, formatDateTime, waMeLink } from "@/lib/adminLabels";
import { LineIcon, SECTION_ICON } from "@/components/LineIcon";
import type { SectionTypeValue } from "@/lib/attempts";

export default async function AdminResultDetailPage({ params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params;

  const attempt = await prisma.attempt.findUnique({
    where: { id: attemptId },
    include: {
      testPackage: {
        include: {
          sections: {
            orderBy: { position: "asc" },
            include: {
              questions: {
                where: { isActive: true },
                orderBy: { position: "asc" },
                include: { choices: { orderBy: { position: "asc" } } },
              },
            },
          },
        },
      },
      certificate: true,
      certificateOrder: true,
    },
  });
  if (!attempt) notFound();

  const answers = await prisma.attemptAnswer.findMany({
    where: { attemptId },
    select: { questionId: true, selectedChoiceKey: true, isCorrect: true },
  });
  const answerByQuestion = new Map(answers.map((a) => [a.questionId, a]));

  const durationMin =
    attempt.completedAt ? Math.round((attempt.completedAt.getTime() - attempt.startedAt.getTime()) / 60000) : null;
  const status = ATTEMPT_STATUS[attempt.status];
  const order = attempt.certificateOrder;
  const wa = waMeLink(order?.whatsappNumber);

  const scaledByType: Record<SectionTypeValue, number | null> = {
    LISTENING: attempt.listeningScaled,
    STRUCTURE: attempt.structureScaled,
    READING: attempt.readingScaled,
  };

  return (
    <>
      <Link href="/admin/results" className="small fw-semibold text-decoration-none d-inline-flex align-items-center gap-1 mb-3">
        <LineIcon name="arrowLeft" size={14} /> Peserta &amp; Skor
      </Link>

      <div className="adm-head">
        <div>
          <h1>{attempt.participantNameSnapshot}</h1>
          <p>
            Mulai {formatDateTime(attempt.startedAt)}
            {durationMin !== null && ` · dikerjakan ${durationMin} menit`}
          </p>
        </div>
        <span className={`badge rounded-pill fs-6 ${status?.badge}`}>{status?.label ?? attempt.status}</span>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-lg-7">
          <div className="tp-card tp-card-accent p-4 h-100">
            <div className="d-flex align-items-center gap-4 flex-wrap">
              <div>
                <div className="adm-label">Skor total</div>
                <div className="tp-score-big tp-text-gradient">{attempt.overallScore ?? "—"}</div>
              </div>
              <div className="d-flex gap-2 flex-grow-1">
                {attempt.testPackage.sections.map((section) => {
                  const correct = section.questions.filter((q) => answerByQuestion.get(q.id)?.isCorrect).length;
                  return (
                    <div className="tp-mini-score flex-fill text-center" key={section.id}>
                      <div className="fs-4 fw-bold text-dark lh-1">{scaledByType[section.type] ?? "—"}</div>
                      <div className="small fw-semibold">{SECTION_INFO[section.type].short}</div>
                      <div className="small text-muted">
                        {correct}/{section.questions.length} benar
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="col-lg-5">
          <div className="tp-card p-4 h-100">
            <div className="adm-label mb-2">Sertifikat</div>
            {attempt.certificate ? (
              <div className="d-flex align-items-center gap-2 flex-wrap mb-2">
                <a
                  href={`/verify/${attempt.certificate.certificateNumber}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-monospace fw-semibold text-decoration-none"
                >
                  {attempt.certificate.certificateNumber} ↗
                </a>
                <span className={`badge rounded-pill ${CERT_STATUS[attempt.certificate.status].badge}`}>
                  {CERT_STATUS[attempt.certificate.status].label}
                </span>
              </div>
            ) : (
              <div className="text-muted mb-2">Belum terbit</div>
            )}

            {order ? (
              <div className="small">
                <div className="d-flex justify-content-between py-1 border-top">
                  <span className="text-muted">Pembayaran</span>
                  <span className={`badge rounded-pill ${ORDER_STATUS[order.status].badge}`}>
                    {ORDER_STATUS[order.status].label}
                  </span>
                </div>
                <div className="d-flex justify-content-between py-1">
                  <span className="text-muted">Nominal</span>
                  <span className="fw-semibold">{formatRupiah(order.amount)}</span>
                </div>
                <div className="d-flex justify-content-between py-1">
                  <span className="text-muted">WhatsApp</span>
                  {wa ? (
                    <a href={wa} target="_blank" rel="noreferrer" className="text-decoration-none">
                      {order.whatsappNumber} ↗
                    </a>
                  ) : (
                    <span>—</span>
                  )}
                </div>
                <div className="d-flex justify-content-between py-1">
                  <span className="text-muted">Kode klaim</span>
                  <a
                    href={`/sertifikat/${order.claimCode}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-monospace text-decoration-none"
                    title="Buka halaman sertifikat peserta"
                  >
                    {order.claimCode} ↗
                  </a>
                </div>
              </div>
            ) : (
              <div className="small text-muted">Peserta belum memesan sertifikat.</div>
            )}
          </div>
        </div>
      </div>

      <h2 className="h5 mb-2">Jawaban per bagian</h2>
      <p className="small text-muted mb-3">
        Urutan pilihan jawaban diacak untuk tiap peserta, jadi yang ditampilkan di sini adalah teks jawabannya,
        bukan hurufnya.
      </p>

      {attempt.testPackage.sections.map((section) => {
        let correct = 0;
        let wrong = 0;
        for (const q of section.questions) {
          const a = answerByQuestion.get(q.id);
          if (!a) continue;
          if (a.isCorrect) correct += 1;
          else wrong += 1;
        }
        const empty = section.questions.length - correct - wrong;

        return (
          <details className="tp-card mb-3" key={section.id}>
            <summary className="p-3 p-md-4 d-flex align-items-center gap-3 flex-wrap" style={{ cursor: "pointer", listStyle: "none" }}>
              <div className="tp-icon-chip is-sm">
                <LineIcon name={SECTION_ICON[section.type]} size={18} />
              </div>
              <span className="fw-bold text-dark flex-grow-1">{SECTION_INFO[section.type].name}</span>
              <span className="badge rounded-pill text-bg-success">{correct} benar</span>
              <span className="badge rounded-pill text-bg-danger">{wrong} salah</span>
              <span className="badge rounded-pill text-bg-secondary">{empty} kosong</span>
              <span className="small text-primary fw-semibold">Lihat detail ▾</span>
            </summary>
            <div className="table-responsive px-3 pb-3">
              <table className="table adm-table table-sm">
                <thead>
                  <tr>
                    <th style={{ width: 48 }}>No.</th>
                    <th>Soal</th>
                    <th>Jawaban peserta</th>
                    <th>Jawaban benar</th>
                  </tr>
                </thead>
                <tbody>
                  {section.questions.map((question) => {
                    const answer = answerByQuestion.get(question.id);
                    const textOf = (key: string | null | undefined) =>
                      question.choices.find((c) => c.choiceKey === key)?.text ?? key ?? "—";
                    return (
                      <tr key={question.id}>
                        <td className="text-muted">{question.number}</td>
                        <td className="small" style={{ maxWidth: 380 }}>
                          {question.stem}
                        </td>
                        <td className="small">
                          {answer ? (
                            <span className={answer.isCorrect ? "text-success fw-semibold" : "text-danger"}>
                              {answer.isCorrect ? "✓ " : "✗ "}
                              {textOf(answer.selectedChoiceKey)}
                            </span>
                          ) : (
                            <span className="text-muted">Tidak dijawab</span>
                          )}
                        </td>
                        <td className="small">{textOf(question.correctChoiceKey)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </details>
        );
      })}
    </>
  );
}
