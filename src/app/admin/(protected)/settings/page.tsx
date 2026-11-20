import { getSettings, formatRupiah } from "@/lib/settings";
import { saveSettingsAction } from "@/app/admin/actions";
import { ActionForm } from "@/components/admin/ActionForm";
import { LineIcon } from "@/components/LineIcon";

function Field({
  name,
  label,
  help,
  defaultValue,
  placeholder,
  inputMode,
}: {
  name: string;
  label: string;
  help?: string;
  defaultValue: string;
  placeholder?: string;
  inputMode?: "numeric" | "tel" | "text";
}) {
  return (
    <div>
      <label className="form-label fw-semibold small" htmlFor={name}>
        {label}
      </label>
      <input
        id={name}
        name={name}
        type="text"
        inputMode={inputMode}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="form-control"
      />
      {help && <div className="form-text">{help}</div>}
    </div>
  );
}

export default async function AdminSettingsPage() {
  const s = await getSettings();
  const missing = [
    !s.bank_account_number && "nomor rekening",
    !s.bank_account_holder && "nama pemilik rekening",
    !s.admin_whatsapp && "nomor WhatsApp admin",
  ].filter(Boolean);

  return (
    <>
      <div className="adm-head">
        <div>
          <h1>Pengaturan</h1>
          <p>Data ini langsung tampil di halaman pembayaran sertifikat peserta.</p>
        </div>
      </div>

      {missing.length > 0 && (
        <div className="tp-card p-3 mb-4 d-flex gap-2 align-items-start" style={{ background: "#fffbeb", borderColor: "#fcd34d" }}>
          <LineIcon name="info" size={20} className="text-warning" />
          <span className="small">
            Belum diisi: <strong>{missing.join(", ")}</strong>. Peserta tidak bisa membayar sertifikat dengan lengkap
            sebelum ini diisi.
          </span>
        </div>
      )}

      <ActionForm action={saveSettingsAction} submitLabel="Simpan pengaturan" submitClassName="btn tp-btn-primary btn-lg">
        <div className="row g-4">
          <div className="col-lg-6">
            <div className="tp-card p-4 h-100">
              <div className="d-flex align-items-center gap-2 mb-3">
                <LineIcon name="award" size={20} className="text-primary" />
                <h2 className="h6 mb-0">Harga sertifikat</h2>
              </div>
              <Field
                name="certificate_price"
                label="Harga (Rupiah)"
                inputMode="numeric"
                defaultValue={s.certificate_price}
                placeholder="75000"
                help={`Tulis angka saja. Saat ini ${formatRupiah(Number(s.certificate_price) || 0)}. Peserta mentransfer harga ini ditambah 3 angka unik.`}
              />
            </div>
          </div>

          <div className="col-lg-6">
            <div className="tp-card p-4 h-100">
              <div className="d-flex align-items-center gap-2 mb-3">
                <LineIcon name="chat" size={20} className="text-primary" />
                <h2 className="h6 mb-0">Konfirmasi lewat WhatsApp</h2>
              </div>
              <div className="d-flex flex-column gap-3">
                <Field
                  name="admin_whatsapp"
                  label="Nomor WhatsApp admin"
                  inputMode="tel"
                  defaultValue={s.admin_whatsapp}
                  placeholder="08123456789"
                  help="Nomor yang menerima foto bukti transfer. Boleh diawali 08 atau 62."
                />
                <Field
                  name="payment_confirmation_sla"
                  label="Lama pengecekan pembayaran"
                  defaultValue={s.payment_confirmation_sla}
                  placeholder="1x24 jam"
                  help='Ditampilkan ke peserta: "Biasanya selesai dalam …".'
                />
              </div>
            </div>
          </div>

          <div className="col-12">
            <div className="tp-card p-4">
              <div className="d-flex align-items-center gap-2 mb-3">
                <LineIcon name="card" size={20} className="text-primary" />
                <h2 className="h6 mb-0">Rekening tujuan transfer</h2>
              </div>
              <div className="row g-3">
                <div className="col-md-4">
                  <Field name="bank_name" label="Nama bank" defaultValue={s.bank_name} placeholder="SeaBank" />
                </div>
                <div className="col-md-4">
                  <Field
                    name="bank_account_number"
                    label="Nomor rekening"
                    inputMode="numeric"
                    defaultValue={s.bank_account_number}
                  />
                </div>
                <div className="col-md-4">
                  <Field name="bank_account_holder" label="Atas nama" defaultValue={s.bank_account_holder} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </ActionForm>

      <p className="small text-muted mt-4 mb-0">
        Catatan: nomor WhatsApp peserta di daftar pembayaran adalah data pribadi — jangan dibagikan ke pihak lain.
      </p>
    </>
  );
}
