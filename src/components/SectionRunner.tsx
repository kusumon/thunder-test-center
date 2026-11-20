"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { saveAnswerAction, submitSection, requestAudioPlay } from "@/app/actions";
import { Icon } from "@/components/Icon";
import { LineIcon, SECTION_ICON } from "@/components/LineIcon";
import { SECTION_INFO } from "@/lib/sectionLabels";
import type { SectionTypeValue } from "@/lib/attempts";
import type { PublicPassage, PublicQuestion } from "@/lib/sections";

type SaveStatus = "idle" | "saving" | "saved" | "retrying" | "failed";
type AudioState = "idle" | "requesting" | "playing" | "ended" | "error";

type OrderedQuestion = PublicQuestion & {
  passage?: { id: string; title: string | null; body: string } | null;
};

/** Stem bawaan bank soal Listening — tidak informatif, diganti petunjuk berbahasa Indonesia. */
const GENERIC_LISTENING_STEM = "Choose the best answer based on the audio.";

const MAX_SAVE_RETRIES = 5;

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

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Ambil kata yang dikutip dari stem, mis. `The word "lies" in line 2 ...` -> "lies". */
function extractHighlightTerm(stem: string): string | null {
  const match = /"([^"]{2,})"/.exec(stem);
  return match ? match[1] : null;
}

function highlightPassage(body: string, term: string | null) {
  if (!term) return body;
  const parts = body.split(new RegExp(`(${escapeRegExp(term)})`, "i"));
  return parts.map((part, i) =>
    part.toLowerCase() === term.toLowerCase() ? <mark key={i}>{part}</mark> : <span key={i}>{part}</span>,
  );
}

/** Ganti deretan titik/elipsis ("……." / "....") di soal isian menjadi garis kosong yang jelas. */
function renderBlankStem(stem: string): ReactNode {
  const parts = stem.split(/(\s*(?:[.…]*…[.…]*|\.{4,}|_{3,})\s*)/);
  if (parts.length === 1) return stem;
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <span key={i}>
        {" "}
        <span className="tp-blank" aria-label="bagian kosong" />{" "}
      </span>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

/**
 * Soal Error Recognition: garis bawahi keempat bagian kalimat yang menjadi
 * pilihan, lengkap dengan huruf A-D-nya — seperti di lembar soal kertas.
 * Pilihan jenis ini tidak diacak (lib/sections.ts), jadi huruf posisi = kunci.
 * Kalau ada bagian yang tidak ketemu di kalimat, tampilkan kalimat apa adanya.
 */
function renderErrorRecognitionStem(stem: string, choiceTexts: string[]): ReactNode {
  const ranges: { start: number; end: number; label: string }[] = [];
  const overlaps = (start: number, end: number) => ranges.some((r) => start < r.end && end > r.start);

  let cursor = 0;
  for (let i = 0; i < choiceTexts.length; i++) {
    const pattern = new RegExp(`\\b${escapeRegExp(choiceTexts[i].trim())}\\b`, "gi");
    let found: { start: number; end: number } | null = null;
    // Coba cari setelah bagian sebelumnya dulu (urutan wajar), lalu dari awal kalimat.
    for (const from of [cursor, 0]) {
      pattern.lastIndex = from;
      let m: RegExpExecArray | null;
      while ((m = pattern.exec(stem))) {
        if (!overlaps(m.index, m.index + m[0].length)) {
          found = { start: m.index, end: m.index + m[0].length };
          break;
        }
      }
      if (found) break;
    }
    if (!found) return stem;
    ranges.push({ ...found, label: String.fromCharCode(65 + i) });
    cursor = found.end;
  }

  ranges.sort((a, b) => a.start - b.start);
  const out: ReactNode[] = [];
  let pos = 0;
  for (const r of ranges) {
    if (r.start > pos) out.push(<span key={`t${pos}`}>{stem.slice(pos, r.start)}</span>);
    out.push(
      <span key={`p${r.start}`}>
        <span className="tp-er-part">{stem.slice(r.start, r.end)}</span>
        <span className="tp-er-label">{r.label}</span>
      </span>,
    );
    pos = r.end;
  }
  if (pos < stem.length) out.push(<span key={`t${pos}`}>{stem.slice(pos)}</span>);
  return out;
}

function questionHint(sectionType: SectionTypeValue, question: PublicQuestion): string {
  if (question.questionType === "ERROR_RECOGNITION") {
    return "Pilih bagian bergaris bawah yang SALAH (yang harus diperbaiki).";
  }
  if (sectionType === "STRUCTURE") return "Pilih jawaban yang tepat untuk mengisi bagian kosong.";
  if (sectionType === "READING") return "Baca bacaannya, lalu pilih jawaban yang paling tepat.";
  return "Dengarkan audio, lalu pilih jawaban yang paling tepat.";
}

function formatTime(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const mm = Math.floor(s / 60)
    .toString()
    .padStart(2, "0");
  const ss = (s % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

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
  const [audioState, setAudioState] = useState<AudioState>("idle");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState<null | "manual" | "timeup">(null);
  const [submitError, setSubmitError] = useState(false);
  const submittedRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const questionTopRef = useRef<HTMLDivElement | null>(null);
  // Pilihan terbaru per soal — retry yang tertunda dibatalkan bila peserta
  // sudah mengganti jawabannya, supaya jawaban lama tidak menimpa yang baru.
  const latestChoiceRef = useRef<Record<string, string>>({});

  const current = ordered[index];
  const info = SECTION_INFO[sectionType];

  const doSubmit = useCallback(
    async (reason: "manual" | "timeup") => {
      if (submittedRef.current) return;
      submittedRef.current = true;
      setConfirmOpen(false);
      setSubmitError(false);
      setSubmitting(reason);
      try {
        await submitSection(attemptCode, sectionType);
      } catch {
        // Gagal (mis. internet putus) — izinkan coba lagi alih-alih macet.
        submittedRef.current = false;
        setSubmitError(true);
      }
    },
    [attemptCode, sectionType],
  );

  // Timer — hanya representasi visual; server memutuskan kapan waktu benar-benar habis (FR-010).
  useEffect(() => {
    const id = setInterval(() => {
      const left = (new Date(endsAt).getTime() - Date.now()) / 1000;
      setRemaining(left);
      if (left <= 0) void doSubmit("timeup");
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

  async function persistAnswer(questionId: string, choiceKey: string, attempt = 0): Promise<void> {
    try {
      await saveAnswerAction(attemptCode, questionId, choiceKey);
      if (latestChoiceRef.current[questionId] === choiceKey) setSaveStatus("saved");
    } catch {
      if (latestChoiceRef.current[questionId] !== choiceKey) return; // sudah diganti, abaikan
      if (attempt >= MAX_SAVE_RETRIES) {
        setSaveStatus("failed");
        return;
      }
      setSaveStatus("retrying");
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
      if (latestChoiceRef.current[questionId] !== choiceKey) return;
      return persistAnswer(questionId, choiceKey, attempt + 1);
    }
  }

  function selectChoice(questionId: string, choiceKey: string) {
    latestChoiceRef.current[questionId] = choiceKey;
    setAnswers((prev) => ({ ...prev, [questionId]: choiceKey }));
    setSaveStatus("saving");
    void persistAnswer(questionId, choiceKey);
  }

  function goTo(i: number) {
    setIndex(Math.max(0, Math.min(ordered.length - 1, i)));
    // Di HP, pindah soal harus membawa layar kembali ke atas soal.
    requestAnimationFrame(() => questionTopRef.current?.scrollIntoView({ block: "start", behavior: "smooth" }));
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
      setAudioState("error");
    }
  }

  const answeredCount = ordered.filter((q) => answers[q.id]).length;
  const unanswered = ordered.filter((q) => !answers[q.id]);
  const isLastQuestion = index === ordered.length - 1;
  const lowTime = remaining <= 300;
  const veryLowTime = remaining <= 60;

  if (!current) return null;

  const stemIsGeneric = sectionType === "LISTENING" && current.stem.trim() === GENERIC_LISTENING_STEM;
  const stemContent =
    current.questionType === "ERROR_RECOGNITION"
      ? renderErrorRecognitionStem(
          current.stem,
          current.choices.map((c) => c.text),
        )
      : sectionType === "STRUCTURE"
        ? renderBlankStem(current.stem)
        : current.stem;

  return (
    <div>
      {/* Bilah atas: selalu terlihat, berisi posisi soal dan sisa waktu. */}
      <div className="tp-testbar">
        <div
          className="container d-flex justify-content-between align-items-center py-2 gap-2"
          style={{ maxWidth: passages.length > 0 ? undefined : 820 }}
        >
          <div className="d-flex align-items-center gap-2 lh-sm">
            <div className="tp-icon-chip is-sm is-solid">
              <LineIcon name={SECTION_ICON[sectionType]} size={18} />
            </div>
            <div>
              <div className="fw-bold text-dark">{info.short}</div>
              <div className="small text-muted">
                Terjawab {answeredCount} dari {ordered.length}
              </div>
            </div>
          </div>
          <div
            className={`tp-timer ${veryLowTime ? "is-low" : lowTime ? "is-warn" : ""}`}
            title="Sisa waktu bagian ini"
            aria-label={`Sisa waktu ${formatTime(remaining)}`}
          >
            <LineIcon name="clock" size={18} />
            {formatTime(remaining)}
          </div>
        </div>
        <div className="tp-progress-line" aria-hidden="true">
          <span style={{ width: `${(answeredCount / Math.max(1, ordered.length)) * 100}%` }} />
        </div>
        {lowTime && remaining > 0 && (
          <div className="text-center small py-1 px-2 fw-semibold" style={{ background: "#fef3c7", color: "#92400e" }}>
            Waktu tinggal sedikit. Jawaban yang sudah dipilih tersimpan otomatis.
          </div>
        )}
      </div>

      {/* Tanpa bacaan (Listening/Structure) kolom soal dibuat ramping supaya
          pilihan jawaban tidak terbentang selebar layar desktop. */}
      <div className="container py-4" style={{ maxWidth: passages.length > 0 ? undefined : 820 }}>
        {sectionType === "LISTENING" && (
          <div className="tp-player p-3 p-md-4 mb-4">
            <audio
              ref={audioRef}
              onEnded={() => setAudioState("ended")}
              onError={() => audioState === "playing" && setAudioState("error")}
              style={{ display: "none" }}
            />

            <div className="d-flex align-items-center gap-3">
              {audioState === "playing" ? (
                <div className="tp-play-btn" aria-hidden="true">
                  <span className="tp-wave" style={{ height: 22 }}>
                    <span style={{ background: "var(--tp-blue)" }} />
                    <span style={{ background: "var(--tp-blue)" }} />
                    <span style={{ background: "var(--tp-blue)" }} />
                  </span>
                </div>
              ) : (
                <button
                  type="button"
                  className="tp-play-btn"
                  onClick={playAudio}
                  disabled={audioState === "requesting" || playsLeft <= 0}
                  aria-label="Putar audio"
                >
                  {audioState === "requesting" ? (
                    <span className="spinner-border spinner-border-sm" aria-hidden="true" />
                  ) : (
                    <Icon name="play" size={28} />
                  )}
                </button>
              )}

              <div className="flex-grow-1">
                <div className="fw-bold fs-5 lh-sm">
                  {audioState === "playing"
                    ? "Audio sedang diputar"
                    : audioState === "requesting"
                      ? "Memuat audio..."
                      : playsLeft <= 0
                        ? "Batas putar sudah habis"
                        : audioState === "ended" || playsLeft < audioMaxPlays
                          ? "Putar ulang dari awal"
                          : "Putar Audio"}
                </div>
                <div className="d-flex align-items-center gap-2 mt-1" style={{ color: "rgba(226,232,240,0.85)" }}>
                  <span className="small">Sisa putar</span>
                  <span className="tp-plays" aria-label={`Sisa putar ${playsLeft} dari ${audioMaxPlays}`}>
                    {Array.from({ length: audioMaxPlays }, (_, i) => (
                      <span key={i} className={i < playsLeft ? "is-left" : ""} />
                    ))}
                  </span>
                  <span className="small fw-semibold">
                    {playsLeft}/{audioMaxPlays}
                  </span>
                </div>
              </div>

              {audioState === "playing" && (
                <span className="tp-wave d-none d-sm-inline-flex" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                  <span />
                  <span />
                </span>
              )}
            </div>

            <div className="small mt-3" style={{ color: "rgba(226,232,240,0.85)" }}>
              {audioState === "playing" &&
                "Jangan tutup atau muat ulang halaman ini. Pilih jawaban tiap soal sambil mendengarkan."}
              {audioState === "idle" &&
                playsLeft === audioMaxPlays &&
                "Tekan Putar Audio untuk mulai. Audio memutar semua soal berurutan dan tidak bisa dijeda."}
              {audioState === "idle" &&
                playsLeft > 0 &&
                playsLeft < audioMaxPlays &&
                "Audio sudah pernah diputar. Memutar lagi akan mengulang dari soal pertama."}
              {audioState === "ended" && playsLeft > 0 && "Audio selesai. Anda masih boleh memutarnya lagi dari awal."}
              {audioState === "error" && (
                <span className="fw-semibold" style={{ color: "#fca5a5" }}>
                  Audio gagal diputar. Periksa koneksi internet Anda, lalu tekan tombol putar lagi.
                </span>
              )}
            </div>
          </div>
        )}

        <div className="row g-4" ref={questionTopRef} style={{ scrollMarginTop: 90 }}>
          {current.passage && (
            <div className="col-lg-6">
              <div className="tp-card p-4 tp-test-content tp-passage">
                <div className="small text-muted mb-2 d-lg-none d-flex align-items-center gap-1">
                  <LineIcon name="book" size={14} /> Bacaan — geser di dalam kotak ini untuk membaca semuanya
                </div>
                {current.passage.title && <h2 className="h6 mb-3 text-primary">{current.passage.title}</h2>}
                <p className="mb-0" style={{ whiteSpace: "pre-line" }}>
                  {highlightPassage(current.passage.body, extractHighlightTerm(current.stem))}
                </p>
              </div>
            </div>
          )}

          <div className={current.passage ? "col-lg-6" : "col-12"}>
            <div className="tp-card tp-card-accent p-4 p-md-4 tp-test-content">
              <div className="d-flex justify-content-between align-items-center mb-2 gap-2">
                <div className="d-flex align-items-baseline gap-2">
                  <span className="fw-bold fs-5 text-dark">Soal {current.number}</span>
                  <span className="small text-muted">
                    ({index + 1} dari {ordered.length})
                  </span>
                </div>
                <div className="small" aria-live="polite">
                  {saveStatus === "saving" && <span className="text-muted">Menyimpan...</span>}
                  {saveStatus === "saved" && <span className="text-success">✓ Tersimpan</span>}
                  {saveStatus === "retrying" && <span className="text-warning">Koneksi lambat, mencoba menyimpan lagi...</span>}
                  {saveStatus === "failed" && (
                    <span className="text-danger">Gagal menyimpan. Periksa internet, lalu pilih jawabannya lagi.</span>
                  )}
                </div>
              </div>

              <div className="small text-primary fw-semibold mb-2 d-flex align-items-center gap-1">
                <LineIcon name="info" size={15} /> {questionHint(sectionType, current)}
              </div>
              {!stemIsGeneric && (
                <p className="fw-semibold text-dark mb-3" style={{ fontSize: "1.08rem", lineHeight: 1.85 }}>
                  {stemContent}
                </p>
              )}

              <div role="radiogroup" aria-label={`Pilihan jawaban soal ${current.number}`}>
                {/* Label A/B/C/D dihitung dari POSISI tampil, bukan dari
                    choice.key — urutan pilihan diacak per attempt (SRS §19)
                    supaya "jawabannya selalu di posisi ke-3" tidak bisa
                    dihafal, tapi peserta tetap melihat A-D berurutan wajar.
                    choice.key (kunci asli) hanya dipakai untuk menyimpan/
                    mencocokkan jawaban, tidak pernah ditampilkan langsung. */}
                {current.choices.map((choice, i) => {
                  const selected = answers[current.id] === choice.key;
                  return (
                    <button
                      type="button"
                      key={choice.key}
                      role="radio"
                      aria-checked={selected}
                      className={`tp-choice ${selected ? "is-selected" : ""}`}
                      onClick={() => selectChoice(current.id, choice.key)}
                    >
                      <span className="tp-choice-letter">{String.fromCharCode(65 + i)}</span>
                      <span>{choice.text}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="d-flex justify-content-between gap-2 mt-3">
              <button
                type="button"
                className="btn tp-btn-ghost btn-lg d-flex align-items-center gap-2"
                disabled={index === 0}
                onClick={() => goTo(index - 1)}
              >
                <LineIcon name="arrowLeft" size={18} />
                <span className="d-none d-sm-inline">Sebelumnya</span>
              </button>
              {isLastQuestion ? (
                <button
                  type="button"
                  className="btn tp-btn-success btn-lg flex-grow-1 d-flex align-items-center justify-content-center gap-2"
                  onClick={() => setConfirmOpen(true)}
                >
                  <LineIcon name="check" size={18} strokeWidth={3} /> Selesai Bagian Ini
                </button>
              ) : (
                <button
                  type="button"
                  className="btn tp-btn-primary btn-lg flex-grow-1 d-flex align-items-center justify-content-center gap-2"
                  onClick={() => goTo(index + 1)}
                >
                  Selanjutnya <LineIcon name="arrowRight" size={18} />
                </button>
              )}
            </div>

            <div className="tp-card p-3 p-md-4 mt-4">
              <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
                <div className="fw-bold small text-dark">Daftar soal — tekan nomor untuk pindah</div>
                <div className="small text-muted d-flex gap-3">
                  <span>
                    <span className="tp-legend-box is-answered" /> sudah dijawab
                  </span>
                  <span>
                    <span className="tp-legend-box" /> belum
                  </span>
                </div>
              </div>
              <div className="tp-nav-grid">
                {ordered.map((q, i) => (
                  <button
                    key={q.id}
                    type="button"
                    aria-label={`Soal ${q.number}${answers[q.id] ? ", sudah dijawab" : ", belum dijawab"}`}
                    className={`tp-nav-item ${i === index ? "is-current" : ""} ${answers[q.id] ? "is-answered" : ""}`}
                    onClick={() => goTo(i)}
                  >
                    {q.number}
                  </button>
                ))}
              </div>
              {!isLastQuestion && (
                <button
                  type="button"
                  className="btn tp-btn-ghost w-100 mt-3"
                  onClick={() => setConfirmOpen(true)}
                >
                  Sudah selesai? Akhiri bagian {info.short}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {confirmOpen && (
        <div className="tp-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
          <div className="tp-modal">
            <div className="tp-icon-chip mb-3">
              <LineIcon name="check" size={24} strokeWidth={2.5} />
            </div>
            <h2 id="confirm-title" className="h5 mb-2">
              Akhiri bagian {info.short}?
            </h2>
            {unanswered.length > 0 ? (
              <>
                <p className="mb-2">
                  Masih ada <strong className="text-danger">{unanswered.length} soal belum dijawab</strong>:
                </p>
                <div className="d-flex flex-wrap gap-1 mb-3">
                  {unanswered.slice(0, 20).map((q) => (
                    <button
                      key={q.id}
                      type="button"
                      className="btn btn-sm btn-outline-danger py-0"
                      onClick={() => {
                        setConfirmOpen(false);
                        goTo(ordered.indexOf(q));
                      }}
                    >
                      {q.number}
                    </button>
                  ))}
                  {unanswered.length > 20 && <span className="small text-muted align-self-center">dan lainnya</span>}
                </div>
              </>
            ) : (
              <p className="mb-2 text-success">Semua soal sudah dijawab.</p>
            )}
            <p className="small text-muted">
              Setelah diakhiri, Anda <strong>tidak bisa kembali</strong> ke bagian ini untuk mengubah jawaban.
            </p>
            <div className="d-flex gap-2">
              <button type="button" className="btn tp-btn-ghost flex-fill" onClick={() => setConfirmOpen(false)}>
                Kembali Mengerjakan
              </button>
              <button type="button" className="btn tp-btn-success flex-fill" onClick={() => void doSubmit("manual")}>
                Ya, Akhiri
              </button>
            </div>
          </div>
        </div>
      )}

      {submitting && (
        <div className="tp-modal-backdrop" role="alertdialog" aria-live="assertive">
          <div className="tp-modal text-center">
            {submitError ? (
              <>
                <h2 className="h5">Gagal terhubung</h2>
                <p className="text-muted">
                  Jawaban Anda aman tersimpan, tetapi halaman berikutnya gagal dimuat. Periksa internet Anda.
                </p>
                <button type="button" className="btn tp-btn-primary w-100" onClick={() => void doSubmit(submitting)}>
                  Coba Lagi
                </button>
              </>
            ) : (
              <>
                <div className="spinner-border text-primary mb-3" aria-hidden="true" />
                <h2 className="h5">{submitting === "timeup" ? "Waktu habis" : "Menyimpan jawaban..."}</h2>
                <p className="text-muted mb-0">Sebentar, Anda sedang dibawa ke langkah berikutnya.</p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
