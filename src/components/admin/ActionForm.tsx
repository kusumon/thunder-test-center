"use client";

import { useActionState, type ReactNode } from "react";
import type { ActionResult } from "@/lib/adminLabels";

type Action = (prev: ActionResult, formData: FormData) => Promise<ActionResult>;

/**
 * Formulir admin dengan umpan balik: tombol berubah jadi "Menyimpan..."
 * selama proses, lalu pesan hijau/merah muncul di bawahnya. Sebelumnya
 * formulir admin tidak memberi tanda apa pun setelah disimpan, dan input
 * yang salah berujung halaman error.
 *
 * `confirmText` memunculkan konfirmasi sebelum aksi yang berisiko
 * (mencabut sertifikat, menonaktifkan paket).
 */
export function ActionForm({
  action,
  children,
  submitLabel,
  submitClassName = "btn tp-btn-primary",
  confirmText,
  className,
  inline = false,
}: {
  action: Action;
  children?: ReactNode;
  submitLabel: string;
  submitClassName?: string;
  confirmText?: string;
  className?: string;
  inline?: boolean;
}) {
  const [state, formAction, pending] = useActionState<ActionResult, FormData>(action, null);

  return (
    <form
      action={formAction}
      className={className}
      onSubmit={(e) => {
        if (confirmText && !window.confirm(confirmText)) e.preventDefault();
      }}
    >
      {children}
      <div className={inline ? "d-inline-flex align-items-center gap-2" : "d-flex align-items-center gap-3 flex-wrap mt-3"}>
        <button type="submit" className={submitClassName} disabled={pending}>
          {pending ? "Menyimpan..." : submitLabel}
        </button>
        {state && (
          <span className={`small fw-semibold ${state.ok ? "text-success" : "text-danger"}`} role="status">
            {state.ok ? "✓ " : ""}
            {state.message}
          </span>
        )}
      </div>
    </form>
  );
}
