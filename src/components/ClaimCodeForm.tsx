"use client";

import { useActionState } from "react";
import { openByClaimCode, type ClaimState } from "@/app/actions";

export function ClaimCodeForm() {
  const [state, formAction, pending] = useActionState<ClaimState, FormData>(openByClaimCode, null);

  return (
    <form action={formAction}>
      <label htmlFor="claimCode" className="form-label fw-semibold">
        Kode Klaim
      </label>
      <input
        id="claimCode"
        name="claimCode"
        type="text"
        className={`form-control form-control-lg font-monospace text-center mb-2 ${state?.error ? "is-invalid" : ""}`}
        style={{ letterSpacing: "0.12em" }}
        placeholder="TPC-XXXX-XXXX"
        autoComplete="off"
        required
      />
      {state?.error && <div className="text-danger small mb-2">{state.error}</div>}
      <button type="submit" className="btn tp-btn-primary btn-lg w-100 mt-2" disabled={pending}>
        {pending ? "Membuka..." : "Buka Sertifikat"}
      </button>
    </form>
  );
}
