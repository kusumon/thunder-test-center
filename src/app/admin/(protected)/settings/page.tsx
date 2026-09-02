import { getSettings, SETTING_DEFAULTS, SETTING_LABELS, type SettingKey } from "@/lib/settings";
import { saveSettingsAction } from "@/app/admin/actions";

export default async function AdminSettingsPage() {
  const settings = await getSettings();
  const keys = Object.keys(SETTING_DEFAULTS) as SettingKey[];

  return (
    <div className="pagetitle mb-4">
      <h1>Pengaturan</h1>

      <div className="card">
        <div className="card-body">
          <h5 className="card-title">Pembayaran Sertifikat</h5>
          <p className="text-muted small">
            Nilai di sini dipakai langsung oleh halaman pemesanan peserta. Kosongkan nomor rekening
            atau WhatsApp untuk sementara menonaktifkan instruksi terkait.
          </p>

          <form action={saveSettingsAction}>
            <div className="row g-3">
              {keys.map((key) => (
                <div className="col-md-6" key={key}>
                  <label className="form-label small" htmlFor={key}>
                    {SETTING_LABELS[key]}
                  </label>
                  <input
                    id={key}
                    name={key}
                    type={key === "certificate_price" ? "number" : "text"}
                    defaultValue={settings[key]}
                    className="form-control"
                  />
                </div>
              ))}
            </div>
            <button type="submit" className="btn tp-btn-primary btn-sm mt-3">
              Simpan Pengaturan
            </button>
          </form>
        </div>
      </div>

      <div className="alert alert-warning small mt-3">
        <strong>Catatan privasi:</strong> nomor WhatsApp peserta yang tersimpan di pesanan adalah
        data pribadi. Tetapkan masa simpan dan hapus bila sudah tidak diperlukan (SRS §23).
      </div>
    </div>
  );
}
