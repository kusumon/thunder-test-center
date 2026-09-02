"use client";

import { useActionState } from "react";
import { startTest, type StartTestState } from "@/app/actions";

export function StartTestForm({ defaultName }: { defaultName: string }) {
  const [state, formAction, pending] = useActionState<StartTestState, FormData>(startTest, null);

  return (
    <form action={formAction} noValidate>
      <label htmlFor="name" className="form-label fw-semibold">
        Nama Lengkap
      </label>
      <input
        id="name"
        name="name"
        type="text"
        className={`form-control form-control-lg mb-2 ${state?.error ? "is-invalid" : ""}`}
        placeholder="Tulis nama lengkap Anda"
        defaultValue={defaultName}
        minLength={2}
        maxLength={120}
        required
        autoComplete="name"
      />
      {state?.error && <div className="text-danger small mb-3">{state.error}</div>}
      <button type="submit" className="btn tp-btn-primary btn-lg w-100 mt-2" disabled={pending}>
        {pending ? "Memulai..." : "Mulai Tes"}
      </button>
    </form>
  );
}
