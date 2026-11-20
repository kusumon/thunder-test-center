"use client";

import { useState } from "react";

/** Tombol kecil "Salin" — supaya peserta tidak salah ketik nomor rekening/nominal. */
export function CopyButton({ value, label = "Salin" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Clipboard API bisa ditolak (http non-localhost, izin browser) —
      // fallback lama lewat textarea tersembunyi.
      const el = document.createElement("textarea");
      el.value = value;
      el.style.position = "fixed";
      el.style.opacity = "0";
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      el.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      type="button"
      onClick={copy}
      className={`btn btn-sm ${copied ? "btn-success" : "btn-outline-primary"} py-0 px-2`}
      style={{ fontSize: "0.78rem" }}
    >
      {copied ? "Tersalin ✓" : label}
    </button>
  );
}
