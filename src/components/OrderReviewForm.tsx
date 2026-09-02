"use client";

import { useState } from "react";

/**
 * Form tinjau pembayaran dengan dua tombol yang berbagi satu kolom catatan.
 *
 * Menolak WAJIB disertai alasan (peserta perlu tahu harus berbuat apa),
 * sedangkan menyetujui tidak. Karena atribut `required` di input akan
 * memblokir kedua tombol, validasinya dikerjakan di sini: tombol Tolak
 * menahan submit dan menampilkan pesan bila catatan kosong — jauh lebih
 * baik daripada admin mendapat layar error dari exception di server.
 */
export function OrderReviewForm({
  orderId,
  approveAction,
  rejectAction,
}: {
  orderId: string;
  approveAction: (formData: FormData) => void;
  rejectAction: (formData: FormData) => void;
}) {
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <form action={approveAction} className="row g-2 mt-3 align-items-start">
      <div className="col-md-8">
        <label className="form-label small mb-1" htmlFor={`note-${orderId}`}>
          Catatan (no. referensi mutasi bank, atau alasan penolakan)
        </label>
        <input
          id={`note-${orderId}`}
          type="text"
          name="note"
          value={note}
          onChange={(e) => {
            setNote(e.target.value);
            if (error) setError(null);
          }}
          className={`form-control form-control-sm ${error ? "is-invalid" : ""}`}
          placeholder="mis. TRX20260824-88213"
        />
        {error && <div className="text-danger small mt-1">{error}</div>}
      </div>
      <div className="col-md-4 d-flex gap-2 pt-4">
        <button type="submit" className="btn btn-sm btn-success">
          Setujui
        </button>
        <button
          type="submit"
          className="btn btn-sm btn-outline-danger"
          formAction={rejectAction}
          onClick={(e) => {
            if (!note.trim()) {
              e.preventDefault();
              setError("Isi alasan penolakan dulu agar peserta tahu langkah berikutnya.");
            }
          }}
        >
          Tolak
        </button>
      </div>
    </form>
  );
}
