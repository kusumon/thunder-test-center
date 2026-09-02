import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";

const SECTION_LABEL: Record<string, string> = {
  LISTENING: "Listening Comprehension",
  STRUCTURE: "Structure & Written Expression",
  READING: "Reading Comprehension",
};

export default async function AdminResultDetailPage({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}) {
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
                orderBy: { position: "asc" },
                include: { choices: { orderBy: { position: "asc" } } },
              },
            },
          },
        },
      },
      certificate: true,
      participantSession: { select: { id: true, createdAt: true } },
    },
  });
  if (!attempt) notFound();

  const answers = await prisma.attemptAnswer.findMany({
    where: { attemptId },
    select: { questionId: true, selectedChoiceKey: true, isCorrect: true },
  });
  const answerByQuestion = new Map(answers.map((a) => [a.questionId, a]));

  return (
    <div className="pagetitle mb-4">
      <h1>Detail Attempt</h1>

      <div className="card mb-3">
        <div className="card-body">
          <div className="row">
            <div className="col-md-4">
              <div className="text-muted small">Peserta</div>
              <div className="fw-semibold">{attempt.participantNameSnapshot}</div>
            </div>
            <div className="col-md-4">
              <div className="text-muted small">Attempt</div>
              <div className="font-monospace">{attempt.publicCode}</div>
            </div>
            <div className="col-md-4">
              <div className="text-muted small">Status</div>
              <span className={`badge ${attempt.status === "COMPLETED" ? "bg-success" : "bg-secondary"}`}>
                {attempt.status}
              </span>
            </div>
          </div>
          <div className="row mt-3">
            <div className="col-md-2">
              <div className="text-muted small">Listening</div>
              <div className="fw-semibold">
                {attempt.listeningScaled ?? "—"} <span className="text-muted small">(raw {attempt.listeningRaw ?? "—"})</span>
              </div>
            </div>
            <div className="col-md-2">
              <div className="text-muted small">Structure</div>
              <div className="fw-semibold">
                {attempt.structureScaled ?? "—"} <span className="text-muted small">(raw {attempt.structureRaw ?? "—"})</span>
              </div>
            </div>
            <div className="col-md-2">
              <div className="text-muted small">Reading</div>
              <div className="fw-semibold">
                {attempt.readingScaled ?? "—"} <span className="text-muted small">(raw {attempt.readingRaw ?? "—"})</span>
              </div>
            </div>
            <div className="col-md-2">
              <div className="text-muted small">Overall</div>
              <div className="fw-bold fs-5 text-primary">{attempt.overallScore ?? "—"}</div>
            </div>
            <div className="col-md-4">
              <div className="text-muted small">Sertifikat</div>
              {attempt.certificate ? (
                <Link href={`/admin/certificates?number=${attempt.certificate.certificateNumber}`}>
                  {attempt.certificate.certificateNumber} ({attempt.certificate.status})
                </Link>
              ) : (
                <span className="text-muted">Belum ada</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {attempt.testPackage.sections.map((section) => (
        <div className="card mb-3" key={section.id}>
          <div className="card-body">
            <h5 className="card-title">{SECTION_LABEL[section.type] ?? section.type}</h5>
            <div className="table-responsive">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th style={{ width: 50 }}>No.</th>
                    <th>Soal</th>
                    <th style={{ width: 90 }}>Jawaban</th>
                    <th style={{ width: 90 }}>Kunci</th>
                    <th style={{ width: 90 }}>Hasil</th>
                  </tr>
                </thead>
                <tbody>
                  {section.questions.map((question) => {
                    const answer = answerByQuestion.get(question.id);
                    return (
                      <tr key={question.id}>
                        <td>{question.number}</td>
                        <td className="small">{question.stem}</td>
                        <td className="text-center">{answer?.selectedChoiceKey ?? "—"}</td>
                        <td className="text-center">{question.correctChoiceKey}</td>
                        <td>
                          {answer ? (
                            <span className={`badge ${answer.isCorrect ? "bg-success" : "bg-danger"}`}>
                              {answer.isCorrect ? "Benar" : "Salah"}
                            </span>
                          ) : (
                            <span className="badge bg-secondary">Kosong</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
