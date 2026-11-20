/**
 * Ikon garis (stroke) 24x24 untuk halaman peserta — gaya tipis-modern yang
 * serasi dengan desain. Inline SVG: tanpa library, tanpa request tambahan.
 */
const ICONS = {
  headphones: [
    "M3 18v-6a9 9 0 0 1 18 0v6",
    "M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3z",
    "M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z",
  ],
  pen: ["M12 20h9", "M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"],
  book: ["M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2z", "M22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z"],
  clock: ["M12 2a10 10 0 1 0 0 20a10 10 0 1 0 0-20", "M12 6v6l4 2"],
  wifi: ["M5 12.55a11 11 0 0 1 14 0", "M1.5 9a16 16 0 0 1 21 0", "M8.5 16.1a6 6 0 0 1 7 0", "M12 20h.01"],
  shield: ["M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z", "M9 12l2 2 4-4"],
  award: ["M12 2a6 6 0 1 0 0 12a6 6 0 1 0 0-12", "M15.5 12.9 17 22l-5-3-5 3 1.5-9.1"],
  zap: ["M13 2 3 14h9l-1 8 10-12h-9z"],
  check: ["M20 6 9 17l-5-5"],
  arrowRight: ["M5 12h14", "M13 5l7 7-7 7"],
  arrowLeft: ["M19 12H5", "M11 19l-7-7 7-7"],
  chart: ["M3 3v18h18", "M8 16v-4", "M13 16V8", "M18 16v-7"],
  user: ["M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2", "M12 3a4 4 0 1 0 0 8a4 4 0 1 0 0-8"],
  key: ["M7.5 10a5.5 5.5 0 1 0 0 11a5.5 5.5 0 1 0 0-11", "M11.4 11.6 21 2", "M16 7l3 3", "M18.5 4.5l2 2"],
  card: ["M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z", "M2 10h20"],
  chat: [
    "M21 11.5a8.4 8.4 0 0 1-9 8.5 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.2A8.4 8.4 0 0 1 4 11.5 8.5 8.5 0 0 1 12.5 3h.5a8.5 8.5 0 0 1 8 8z",
  ],
  download: ["M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4", "M7 10l5 5 5-5", "M12 15V3"],
  info: ["M12 2a10 10 0 1 0 0 20a10 10 0 1 0 0-20", "M12 16v-4", "M12 8h.01"],
  hourglass: ["M6 2h12", "M6 22h12", "M7 2v4l5 6 5-6V2", "M7 22v-4l5-6 5 6v4"],
  refresh: ["M21 12a9 9 0 1 1-3-6.7L21 8", "M21 3v5h-5"],
  sparkle: ["M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z", "M19 17l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"],
} as const;

export type LineIconName = keyof typeof ICONS;

export function LineIcon({
  name,
  size = 22,
  strokeWidth = 2,
  className,
}: {
  name: LineIconName;
  size?: number;
  strokeWidth?: number;
  className?: string;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      style={{ flexShrink: 0 }}
    >
      {ICONS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

/** Ikon khas tiap bagian tes. */
export const SECTION_ICON: Record<"LISTENING" | "STRUCTURE" | "READING", LineIconName> = {
  LISTENING: "headphones",
  STRUCTURE: "pen",
  READING: "book",
};
