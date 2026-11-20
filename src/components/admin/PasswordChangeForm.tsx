"use client";

import { useActionState, useState } from "react";
import { changePasswordAction } from "@/app/admin/actions";
import type { ActionResult } from "@/lib/adminLabels";

const MIN_LENGTH = 10;

function Check({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className={ok ? "text-success" : "text-muted"}>
      {ok ? "✓" : "○"} {children}
    </li>
  );
}

export function PasswordChangeForm() {
  const [state, formAction, pending] = useActionState<ActionResult, FormData>(changePasswordAction, null);
  const [show, setShow] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");

  const longEnough = next.length >= MIN_LENGTH;
  const different = next.length > 0 && next !== current;
  const matches = confirm.length > 0 && next === confirm;
  const ready = current.length > 0 && longEnough && different && matches;
  const type = show ? "text" : "password";

  return (
    // React mengosongkan formulir otomatis setelah dikirim (berhasil maupun
    // gagal) — onReset menyamakan state pemeriksa dengan isian yang kosong,
    // jadi password juga tidak tertinggal di layar.
    <form
      action={formAction}
      onReset={() => {
        setCurrent("");
        setNext("");
        setConfirm("");
      }}
    >
      <div className="row g-3">
        <div className="col-md-4">
          <label className="form-label fw-semibold small" htmlFor="currentPassword">
            Password sekarang
          </label>
          <input
            id="currentPassword"
            name="currentPassword"
            type={type}
            autoComplete="current-password"
            className="form-control"
            onChange={(e) => setCurrent(e.target.value)}
            required
          />
        </div>
        <div className="col-md-4">
          <label className="form-label fw-semibold small" htmlFor="newPassword">
            Password baru
          </label>
          <input
            id="newPassword"
            name="newPassword"
            type={type}
            autoComplete="new-password"
            className="form-control"
            onChange={(e) => setNext(e.target.value)}
            required
          />
        </div>
        <div className="col-md-4">
          <label className="form-label fw-semibold small" htmlFor="confirmPassword">
            Ulangi password baru
          </label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type={type}
            autoComplete="new-password"
            className={`form-control ${confirm && !matches ? "is-invalid" : ""}`}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
        </div>
      </div>

      <div className="d-flex justify-content-between align-items-start flex-wrap gap-2 mt-3">
        <ul className="list-unstyled small mb-0">
          <Check ok={longEnough}>Minimal {MIN_LENGTH} karakter</Check>
          <Check ok={different}>Berbeda dari password sekarang</Check>
          <Check ok={matches}>Kedua password baru sama</Check>
        </ul>
        <div className="form-check">
          <input
            id="showPassword"
            type="checkbox"
            className="form-check-input"
            checked={show}
            onChange={(e) => setShow(e.target.checked)}
          />
          <label className="form-check-label small" htmlFor="showPassword">
            Tampilkan password
          </label>
        </div>
      </div>

      <div className="d-flex align-items-center gap-3 flex-wrap mt-3">
        <button type="submit" className="btn tp-btn-primary" disabled={pending || !ready}>
          {pending ? "Menyimpan..." : "Ganti Password"}
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
