"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { finishAudioUpload, prepareAudioUpload } from "@/app/admin/actions";

type Status =
  | { kind: "idle" }
  | { kind: "uploading"; percent: number }
  | { kind: "done"; message: string }
  | { kind: "error"; message: string };

/** Kirim file langsung ke tautan unggah Supabase, dengan persentase kemajuan. */
function putWithProgress(url: string, file: File, onProgress: (percent: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    // Format sama dengan uploadToSignedUrl() milik @supabase/storage-js untuk body mentah.
    xhr.setRequestHeader("content-type", "audio/mpeg");
    xhr.setRequestHeader("x-upsert", "true");
    xhr.setRequestHeader("cache-control", "max-age=3600");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Server menolak unggahan (kode ${xhr.status}).`)));
    xhr.onerror = () => reject(new Error("Koneksi terputus saat mengunggah. Periksa internet lalu coba lagi."));
    xhr.send(file);
  });
}

export function AudioUploader({ sectionId }: { sectionId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const busy = status.kind === "uploading";

  async function upload() {
    const file = inputRef.current?.files?.[0];
    if (!file) {
      setStatus({ kind: "error", message: "Pilih file MP3 terlebih dahulu." });
      return;
    }
    if (!window.confirm(`Ganti audio Listening dengan "${file.name}"? Peserta berikutnya akan mendengar file ini.`)) {
      return;
    }

    setStatus({ kind: "uploading", percent: 0 });
    try {
      const prep = await prepareAudioUpload(sectionId, file.name);
      if (!prep.ok) throw new Error(prep.message);
      await putWithProgress(prep.signedUrl, file, (percent) => setStatus({ kind: "uploading", percent }));
      const result = await finishAudioUpload(sectionId, prep.fileName);
      if (!result?.ok) throw new Error(result?.message ?? "Gagal menyimpan audio.");
      setStatus({ kind: "done", message: result.message });
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    } catch (error) {
      setStatus({ kind: "error", message: error instanceof Error ? error.message : "Gagal mengunggah." });
    }
  }

  return (
    <div>
      <div className="d-flex gap-2 flex-wrap align-items-center">
        <input
          ref={inputRef}
          type="file"
          accept="audio/mpeg,.mp3"
          className="form-control"
          style={{ maxWidth: 340 }}
          disabled={busy}
          onChange={() => setStatus({ kind: "idle" })}
        />
        <button type="button" className="btn tp-btn-primary" onClick={upload} disabled={busy}>
          {busy ? "Mengunggah..." : "Unggah & Ganti"}
        </button>
      </div>

      {status.kind === "uploading" && (
        <div className="mt-3">
          <div className="d-flex justify-content-between small mb-1">
            <span>Mengunggah — jangan tutup halaman ini</span>
            <span className="fw-semibold">{status.percent}%</span>
          </div>
          <div className="tp-progress-line rounded-pill overflow-hidden" style={{ height: 8 }}>
            <span style={{ width: `${status.percent}%` }} />
          </div>
        </div>
      )}
      {status.kind === "done" && <div className="small fw-semibold text-success mt-2">✓ {status.message}</div>}
      {status.kind === "error" && <div className="small fw-semibold text-danger mt-2">{status.message}</div>}
    </div>
  );
}
