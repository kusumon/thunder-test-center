"use client";

import { useActionState } from "react";
import { adminLogin, type AdminLoginState } from "@/app/admin/actions";

export function AdminLoginForm() {
  const [state, formAction, pending] = useActionState<AdminLoginState, FormData>(adminLogin, null);

  return (
    <form action={formAction}>
      <label htmlFor="email" className="form-label fw-semibold">
        Email
      </label>
      <input
        id="email"
        name="email"
        type="email"
        className="form-control mb-3"
        required
        autoComplete="username"
      />

      <label htmlFor="password" className="form-label fw-semibold">
        Password
      </label>
      <input
        id="password"
        name="password"
        type="password"
        className="form-control mb-3"
        required
        autoComplete="current-password"
      />

      {state?.error && <div className="alert alert-danger py-2 small">{state.error}</div>}

      <button type="submit" className="btn tp-btn-primary w-100" disabled={pending}>
        {pending ? "Masuk..." : "Masuk"}
      </button>
    </form>
  );
}
