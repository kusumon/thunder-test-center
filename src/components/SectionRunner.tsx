"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { saveAnswerAction, submitSection, requestAudioPlay } from "@/app/actions";
import { Icon } from "@/components/Icon";
import type { SectionTypeValue } from "@/lib/attempts";
import type { PublicPassage, PublicQuestion } from "@/lib/sections";

type SaveStatus = "idle" | "saving" | "saved" | "error";

type OrderedQuestion = PublicQuestion & {
  passage?: { id: string; title: string | null; body: string } | null;
};

function buildOrderedQuestions(
  questions: PublicQuestion[],
  passages: PublicPassage[],
): OrderedQuestion[] {
  if (passages.length > 0) {
    return passages.flatMap((p) =>
      p.questions.map((q) => ({ ...q, passage: { id: p.id, title: p.title, body: p.body } })),
    );
  }
  return questions.map((q) => ({ ...q, passage: null }));
}

/** Ambil kata yang dikutip dari stem, mis. `The word "lies" in line 2 ...` -> "lies". */
function extractHighlightTerm(stem: string): string | null {
  const match = /"([^"]{2,})"/.exec(stem);
  return match ? match[1] : null;
}

function highlightPassage(body: string, term: string | null) {
  if (!term) return body;
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = body.split(new RegExp(`(${escaped})`, "i"));
  return parts.map((part, i) =>
    part.toLowerCase() === term.toLowerCase() ? (
      <mark key={i}>{part}</mark>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

function formatTime(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const mm = Math.floor(s / 60)
    .toString()
    .padStart(2, "0");
  const ss = (s % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

const SECTION_LABEL: Record<SectionTypeValue, string> = {
  LISTENING: "Listening Comprehension",
  STRUCTURE: "Structure & Written Expression",
  READING: "Reading Comprehension",
};

export function SectionRunner({
  attemptCode,
  sectionType,
  endsAt,
  questions,
  passages,
  initialAnswers,
  audioPlaysLeft,
  audioMaxPlays,
}: {
  attemptCode: string;
  sectionType: SectionTypeValue;
  endsAt: string;
  questions: PublicQuestion[];
  passages: PublicPassage[];
  initialAnswers: Record<string, string>;
  audioPlaysLeft: number;
  audioMaxPlays: number;
}) {
  const ordered = useMemo(() => buildOrderedQuestions(questions, passages), [questions, passages]);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>(initialAnswers);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [remaining, setRemaining] = useState(() => (new Date(endsAt).getTime() - Date.now()) / 1000);
  const [playsLeft, setPlaysLeft] = useState(audioPlaysLeft);
  const [audioState, setAudioState] = useState<"idle" | "requesting" | "playing" | "ended">("idle");
  const submittedRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const current = ordered[index];

  const doSubmit = useCallback(() => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    void submitSection(attemptCode, sectionType);
  }, [attemptCode, sectionType]);

  // Timer — hanya representasi visual; server memutuskan kapan waktu benar-benar habis (FR-010).
  useEffect(() => {
    const id = setInterval(() => {
      const left = (new Date(endsAt).getTime() - Date.now()) / 1000;
      setRemaining(left);
      if (left <= 0) doSubmit();
    }, 1000);
    return () => clearInterval(id);
  }, [endsAt, doSubmit]);

  // Deterren anti-copy — FR-018/FR-019 (bukan DRM, hanya penghambat).
  useEffect(() => {
    const blockContextMenu = (e: MouseEvent) => e.preventDefault();
    const blockShortcuts = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const isModifier = e.ctrlKey || e.metaKey;
      if (isModifier && ["c", "a", "s", "p", "u"].includes(key)) e.preventDefault();
    };
    document.addEventListener("contextmenu", blockContextMenu);
    document.addEventListener("keydown", blockShortcuts);
    return () => {
      document.removeEventListener("contextmenu", blockContextMenu);
      document.removeEventListener("keydown", blockShortcuts);
    };
  }, []);

  async function selectChoice(questionId: string, choiceKey: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: choiceKey }));
    setSaveStatus("saving");
    try {
      await saveAnswerAction(attemptCode, questionId, choiceKey);
      setSaveStatus("saved");
    } catch {
      setSaveStatus("error");
    }
  }

  /**
   * Minta izin putar ke server dulu, baru mainkan. Server yang menghitung
   * dan memutuskan — tombol di sini hanya cerminan, bukan penjaga.
   */
  async function playAudio() {
    if (audioState === "requesting" || audioState === "playing" || playsLeft <= 0) return;
    setAudioState("requesting");
    try {
      const grant = await requestAudioPlay(attemptCode);
      setPlaysLeft(grant.playsLeft);
      if (!grant.allowed) {
        setAudioState("ended");
        return;
      }
      const audio = audioRef.current;
      if (audio) {
        audio.src = `/api/audio/${attemptCode}?play=${grant.playsUsed}`;
        await audio.play();
        setAudioState("playing");
      }
    } catch {
      setAudioState("idle");
    }
  }

  const answeredCount = Object.keys(answers).length;
  const isLastQuestion = index === ordered.length - 1;
  const lowTime = remaining <= 60;

  if (!current) return null;

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center bg-white border-bottom px-3 py-2 sticky-top">
        <div className="small text-muted">
          {SECTION_LABEL[sectionType]} · Soal {index + 1} dari {ordered.length} · {answeredCount} terjawab
        </div>
        <div className={`tp-timer fs-5 ${lowTime ? "is-low" : "text-primary"}`}>{formatTime(remaining)}</div>
      </div>

      <div className="container py-4">
        {sectionType === "LISTENING" && (
          <div className="tp-card p-3 mb-4 d-flex align-items-center gap-3 flex-wrap">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <audio ref={audioRef} onEnded={() => setAudioState("ended")} style={{ display: "none" }} />

            {audioState === "playing" ? (
              <span className="text-muted small">Audio sedang diputar — jangan tutup halaman ini.</span>
            ) : playsLeft > 0 ? (
              <button
                type="button"
                className="btn tp-btn-primary"
                onClick={playAudio}
                disabled={audioState === "requesting"}
              >
                <Icon name="play" />{" "}
                {audioState === "ended" ? "Putar Ulang Audio" : "Putar Audio Sekarang"}
              </button>
            ) : (
              <span className="text-muted small">Jatah pemutaran audio sudah habis.</span>
            )}

            <span className="badge text-bg-light border">
              Sisa pemutaran: {playsLeft} dari {audioMaxPlays}
            </span>
          </div>
        )}

        <div className="row g-4">
          {current.passage && (
            <div className="col-lg-6">
              <div className="tp-card p-4 tp-test-content" style={{ maxHeight: "70vh", overflowY: "auto" }}>
                {current.passage.title && <h2 className="h6 mb-3">{current.passage.title}</h2>}
                <p style={{ whiteSpace: "pre-line" }}>
                  {highlightPassage(current.passage.body, extractHighlightTerm(current.stem))}
                </p>
              </div>
            </div>
          )}

          <div className={current.passage ? "col-lg-6" : "col-12"}>
            <div className="tp-card p-4 tp-test-content">
              <div className="text-muted small mb-1">Soal {current.number}</div>
              <p className="fw-semibold">{current.stem}</p>

              <div>
                {/* Label A/B/C/D dihitung dari POSISI tampil, bukan dari
                    choice.key — urutan pilihan diacak per attempt (SRS §19)
                    supaya "jawabannya selalu di posisi ke-3" tidak bisa
                    dihafal, tapi peserta tetap melihat A-D berurutan wajar.
                    choice.key (kunci asli) hanya dipakai untuk menyimpan/
                    mencocokkan jawaban, tidak pernah ditampilkan langsung. */}
                {current.choices.map((choice, index) => (
                  <div
                    key={choice.key}
                    className={`tp-choice ${answers[current.id] === choice.key ? "is-selected" : ""}`}
                    onClick={() => selectChoice(current.id, choice.key)}
                    role="button"
                  >
                    <strong>{String.fromCharCode(65 + index)}.</strong> {choice.text}
                  </div>
                ))}
              </div>

              <div className="small text-muted mt-2">
                {saveStatus === "saving" && "Menyimpan..."}
                {saveStatus === "saved" && "Tersimpan"}
                {saveStatus === "error" && <span className="text-danger">Koneksi terputus — mencoba lagi.</span>}
              </div>
            </div>

            <div className="d-flex justify-content-between mt-3">
              <button
                type="button"
                className="btn btn-outline-secondary"
                disabled={index === 0}
                onClick={() => setIndex((i) => Math.max(0, i - 1))}
              >
                Sebelumnya
              </button>
              {isLastQuestion ? (
                <button type="button" className="btn tp-btn-primary" onClick={doSubmit}>
                  Selesai Bagian
                </button>
              ) : (
                <button
                  type="button"
                  className="btn tp-btn-primary"
                  onClick={() => setIndex((i) => Math.min(ordered.length - 1, i + 1))}
                >
                  Selanjutnya
                </button>
              )}
            </div>

            <div className="tp-nav-grid mt-4">
              {ordered.map((q, i) => (
                <button
                  key={q.id}
                  type="button"
                  className={`tp-nav-item position-relative ${i === index ? "is-current" : ""} ${
                    answers[q.id] ? "is-answered" : ""
                  }`}
                  onClick={() => setIndex(i)}
                >
                  {q.number}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
