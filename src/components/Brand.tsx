/**
 * Logo Thunder Test Center: bilah petir di dalam cakram biru bergradasi.
 *
 * Dibuat sebagai SVG inline supaya tidak ada request gambar tambahan dan
 * tetap tajam di ukuran berapa pun. Bentuk petirnya sama persis dengan yang
 * dipakai di emblem sertifikat PDF (src/lib/certificatePdf.tsx).
 */
export const BOLT_PATH =
  "M5.52.359A.5.5 0 0 1 6 0h4a.5.5 0 0 1 .474.658L8.694 6H12.5a.5.5 0 0 1 .395.807l-7 9a.5.5 0 0 1-.873-.454L6.823 9.5H3.5a.5.5 0 0 1-.48-.641l2.5-8.5z";

export function ThunderMark({ size = 40, id = "brand" }: { size?: number; id?: string }) {
  const r = size / 2;
  const bolt = size * 0.5;
  const offset = (size - bolt) / 2;
  const scale = bolt / 16;
  const gradientId = `${id}-grad`;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#1e3a8a" />
          <stop offset="100%" stopColor="#3b82f6" />
        </linearGradient>
      </defs>
      <circle cx={r} cy={r} r={r} fill={`url(#${gradientId})`} />
      <g transform={`translate(${offset}, ${offset}) scale(${scale})`}>
        <path d={BOLT_PATH} fill="#ffffff" />
      </g>
    </svg>
  );
}

/** Logo + nama lembaga, dipakai di header halaman peserta dan admin. */
export function BrandLockup({
  size = 40,
  subtitle,
  id = "brand",
}: {
  size?: number;
  subtitle?: string;
  id?: string;
}) {
  return (
    <span className="d-inline-flex align-items-center gap-2">
      <ThunderMark size={size} id={id} />
      <span className="d-flex flex-column lh-1">
        <span className="tp-brand" style={{ letterSpacing: "0.08em" }}>
          THUNDER TEST CENTER
        </span>
        {subtitle && (
          <span className="text-muted" style={{ fontSize: "0.68rem", letterSpacing: "0.14em" }}>
            {subtitle.toUpperCase()}
          </span>
        )}
      </span>
    </span>
  );
}
