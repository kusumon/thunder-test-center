import { LineIcon } from "@/components/LineIcon";

/** Disclaimer legal/branding wajib — SRS §22 & §29 butir 6. */
export function Disclaimer() {
  return (
    <p className="tp-disclaimer mb-0">
      <LineIcon name="info" size={16} />
      <span>
        Website ini menyediakan tes prediksi/simulasi bergaya TOEFL untuk latihan dan asesmen
        internal. Ini <strong>bukan</strong> layanan tes TOEFL resmi dari ETS, dan sertifikat yang
        dihasilkan sistem ini <strong>bukan</strong> laporan skor TOEFL resmi ETS.
      </span>
    </p>
  );
}
