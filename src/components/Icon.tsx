/**
 * Ikon SVG inline.
 *
 * Menggantikan paket Bootstrap Icons (CSS 73 KB + font woff2 90 KB untuk
 * ~1.800 ikon) yang sebelumnya dimuat di SETIAP halaman — termasuk halaman
 * peserta yang cuma memakai satu ikon. Di sini hanya ikon yang benar-benar
 * dipakai yang ikut ter-bundle, dan tidak ada request font tambahan.
 *
 * Path diambil dari Bootstrap Icons (lisensi MIT).
 */
const PATHS = {
  play: "M11.596 8.697l-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393z",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden="true"
      style={{ verticalAlign: "-0.125em", flexShrink: 0 }}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
