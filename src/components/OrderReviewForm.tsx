"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ActionResult } from "@/lib/adminLabels";

type Action = (prev: ActionResult, formData: FormData) => Promise<ActionResult>;

/**
 * Tombol Setujui / Tolak untuk satu pembayaran, berbagi satu kolom catatan.
 *
 * Menolak WAJIB disertai alasan (peserta perlu tahu harus berbuat apa) —
 * divalidasi di sini supaya admin langsung diberi tahu, bukan dilempar ke
 * halaman error.
 */
export function OrderReviewForm({
  orderId,
  amountLabel,
  approveAction,
  rejectAction,
}: {
  orderId: string;
  amountLabel: string;
  approveAction: Action;
  rejectAction: Action;
}) {
  const [note, setNote] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [approveState, approveFormAction, approving] = useActionState<ActionResult, FormData>(approveAction, null);
  const [rejectState, rejectFormAction, rejecting] = useActionState<ActionResult, FormData>(rejectAction, null);
  const router = useRouter();
  const pending = approving || rejecting;
  const result = localError ? { ok: false, message: localError } : (rejectState ?? approveState);
  const done = Boolean(approveState?.ok || rejectState?.ok);

  // Setelah berhasil: tampilkan pesan sebentar, lalu muat ulang daftar
  // (dan angka di menu samping).
  useEffect(() => {
    if (!done) return;
    const id = setTimeout(() => router.refresh(), 2500);
    return () => clearTimeout(id);
  }, [done, router]);

  if (done && result) {
    return (
      <div className="tp-note mt-3 fw-semibold text-success" role="status">
        ✓ {result.message}
      </div>
    );
  }

  return (
    <form action={approveFormAction} className="mt-3">
      <label className="form-label small fw-semibold mb-1" htmlFor={`note-${orderId}`}>
        Catatan <span className="text-muted fw-normal">(wajib diisi kalau menolak)</span>
      </label>
      <input
        id={`note-${orderId}`}
        type="text"
        name="note"
        value={note}
        onChange={(e) => {
          setNote(e.target.value);
          setLocalError(null);
        }}
        className={`form-control ${localError ? "is-invalid" : ""}`}
        placeholder="Contoh: sudah masuk 21 Nov 09.15 — atau alasan penolakan"
      />
      <div className="d-flex gap-2 mt-2 flex-wrap">
        <button
          type="submit"
          className="btn tp-btn-success"
          disabled={pending}
          onClick={(e) => {
            if (!window.confirm(`Setujui pembayaran ${amountLabel}? Sertifikat akan langsung terbit.`)) {
              e.preventDefault();
            }
          }}
        >
          {approving ? "Memproses..." : "✓ Setujui"}
        </button>
        <button
          type="submit"
          className="btn tp-btn-ghost text-danger"
          formAction={rejectFormAction}
          disabled={pending}
          onClick={(e) => {
            if (!note.trim()) {
              e.preventDefault();
              setLocalError("Tulis dulu alasan penolakannya, supaya peserta tahu harus berbuat apa.");
            }
          }}
        >
          {rejecting ? "Memproses..." : "Tolak"}
        </button>
      </div>
      {result && (
        <div className={`small fw-semibold mt-2 ${result.ok ? "text-success" : "text-danger"}`} role="status">
          {result.message}
        </div>
      )}
    </form>
  );
}
