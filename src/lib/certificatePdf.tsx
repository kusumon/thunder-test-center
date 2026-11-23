import "server-only";
import { join } from "node:path";
import {
  Document,
  Page,
  View,
  Text,
  Image,
  Svg,
  Path,
  Circle,
  Rect,
  Line,
  Defs,
  LinearGradient,
  Stop,
  Font,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import type { Style } from "@react-pdf/stylesheet";
import QRCode from "qrcode";
import {
  cefrLevel,
  MAX_SECTION_SCORE,
  MAX_TOTAL_SCORE,
} from "@/lib/scoreLevel";

export type CertificatePdfData = {
  certificateNumber: string;
  participantName: string;
  overallScore: number;
  listeningScaled: number;
  structureScaled: number;
  readingScaled: number;
  completedAt: Date;
  institutionName: string;
  signatoryName: string;
  signatoryPosition: string;
  verifyUrl: string;
  /** PNG transparan tanda tangan (lib/signatureAsset.ts). Null = garis kosong. */
  signaturePng?: Buffer | null;
};

/* ------------------------------------------------------------------ *
 * Font — Montserrat saja, file lokal (bukan fetch ke Google saat render)
 * supaya pembuatan PDF tidak bergantung koneksi internet; next.config.ts
 * mendaftarkan folder ini di outputFileTracingIncludes.
 * Lisensi: SIL Open Font License 1.1 (src/lib/fonts/OFL.txt).
 * ------------------------------------------------------------------ */
const FONT_DIR = join(process.cwd(), "src", "lib", "fonts");
let fontsRegistered = false;

function registerFonts() {
  if (fontsRegistered) return;
  fontsRegistered = true;

  Font.register({
    family: "Montserrat",
    fonts: [
      { src: join(FONT_DIR, "Montserrat-Regular.ttf"), fontWeight: 400 },
      { src: join(FONT_DIR, "Montserrat-Medium.ttf"), fontWeight: 500 },
      { src: join(FONT_DIR, "Montserrat-SemiBold.ttf"), fontWeight: 600 },
      { src: join(FONT_DIR, "Montserrat-Bold.ttf"), fontWeight: 700 },
    ],
  });
  // Nama peserta tidak boleh terpenggal tanda hubung.
  Font.registerHyphenationCallback((word) => [word]);
}

/* ----------------------------- Palet ----------------------------- */
const INK = "#0b1b3f";
const NAVY = "#12285c";
const ROYAL = "#1e40af";
const BLUE = "#2563eb";
const BLUE_BRIGHT = "#3b82f6";
const CYAN = "#22d3ee";
const SKY = "#93c5fd";
const LINE = "#e2e8f0";
const GRAY = "#64748b";
const WHITE = "#ffffff";

const PAGE_W = 841.89;
const PAGE_H = 595.28;
const CARD_W = 232;
const CARD_H = 290;

/** Bentuk petir (Bootstrap Icons `lightning-fill`, lisensi MIT), viewBox 16x16. */
const BOLT_PATH =
  "M5.52.359A.5.5 0 0 1 6 0h4a.5.5 0 0 1 .474.658L8.694 6H12.5a.5.5 0 0 1 .395.807l-7 9a.5.5 0 0 1-.873-.454L6.823 9.5H3.5a.5.5 0 0 1-.48-.641l2.5-8.5z";

/**
 * Sisipkan fontFeatureSettings ke tiap style bertipografi. Ligature GSUB
 * ("fi", "Th") membuat fontkit salah menghitung indeks glyph saat wrapping
 * sehingga huruf hilang di tengah kata ("Certificate" → "Certifcate").
 */
const NO_LIGATURES = {
  liga: false,
  dlig: false,
  clig: false,
  calt: false,
  rlig: false,
};

function withNoLigatures<T extends Record<string, Style>>(raw: T): T {
  return Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [
      key,
      value.fontFamily
        ? { ...value, fontFeatureSettings: NO_LIGATURES }
        : value,
    ]),
  ) as T;
}

const F = "Montserrat";

const rawStyles: Record<string, Style> = {
  // Padding ada di `frame`, bukan di Page: latar SVG selebar halaman penuh
  // yang ditaruh di Page ber-padding tidak muat di area kontennya, sehingga
  // react-pdf memindahkan seluruh isi ke halaman kedua.
  page: { backgroundColor: WHITE, fontFamily: F },
  frame: {
    width: PAGE_W,
    height: PAGE_H,
    paddingTop: 40,
    paddingBottom: 30,
    paddingLeft: 56,
    paddingRight: 50,
    display: "flex",
    flexDirection: "column",
  },

  /* --- Kepala: identitas penerbit + nomor sertifikat --- */
  header: {
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  brandRow: { display: "flex", flexDirection: "row", alignItems: "center" },
  brandName: {
    fontFamily: F,
    fontWeight: 700,
    fontSize: 11.5,
    letterSpacing: 2.2,
    color: INK,
    marginLeft: 10,
  },
  brandSub: {
    fontFamily: F,
    fontWeight: 500,
    fontSize: 6.3,
    letterSpacing: 1.8,
    color: GRAY,
    textTransform: "uppercase",
    marginLeft: 10,
    marginTop: 2,
  },
  idChip: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 0.8,
    borderColor: "#dbeafe",
    backgroundColor: "#f8fbff",
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 11,
  },
  idLabel: {
    fontFamily: F,
    fontWeight: 600,
    fontSize: 5.8,
    letterSpacing: 1.4,
    color: GRAY,
    textTransform: "uppercase",
  },
  idValue: {
    fontFamily: F,
    fontWeight: 700,
    fontSize: 8,
    color: INK,
    marginLeft: 6,
  },

  /* --- Isi utama --- */
  main: {
    display: "flex",
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 42,
  },
  // Lebar eksplisit (halaman − padding − kartu skor): tanpa ini teks nama
  // panjang tidak dipatah ke baris baru dan malah menyusup ke bawah kartu.
  left: {
    width: PAGE_W - 56 - 50 - CARD_W,
    paddingRight: 34,
    display: "flex",
    flexDirection: "column",
  },
  eyebrow: {
    alignSelf: "flex-start",
    backgroundColor: "#eff6ff",
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 11,
    fontFamily: F,
    fontWeight: 700,
    fontSize: 7.2,
    letterSpacing: 2.6,
    color: BLUE,
    textTransform: "uppercase",
  },
  certifies: {
    fontFamily: F,
    fontWeight: 500,
    fontSize: 9.5,
    color: GRAY,
    marginTop: 18,
  },
  name: {
    fontFamily: F,
    fontWeight: 700,
    color: INK,
    marginTop: 4,
    lineHeight: 1.15,
  },
  description: {
    fontFamily: F,
    fontWeight: 400,
    fontSize: 9.3,
    color: GRAY,
    lineHeight: 1.65,
    marginTop: 14,
    maxWidth: 440,
  },
  strong: { fontFamily: F, fontWeight: 700, color: INK },

  sections: { display: "flex", flexDirection: "row", marginTop: 28 },
  sectionCard: {
    width: 142,
    marginRight: 10,
    borderWidth: 0.8,
    borderColor: LINE,
    borderRadius: 12,
    backgroundColor: "#fbfdff",
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  sectionLabel: {
    fontFamily: F,
    fontWeight: 600,
    fontSize: 6,
    letterSpacing: 1.3,
    color: GRAY,
    textTransform: "uppercase",
  },
  sectionValueRow: {
    display: "flex",
    flexDirection: "row",
    alignItems: "flex-end",
    marginTop: 4,
    marginBottom: 7,
  },
  sectionValue: {
    fontFamily: F,
    fontWeight: 700,
    fontSize: 21,
    color: INK,
    lineHeight: 1,
  },
  sectionMax: {
    fontFamily: F,
    fontWeight: 500,
    fontSize: 7.5,
    color: "#94a3b8",
    marginLeft: 3,
    marginBottom: 2,
  },

  /* --- Kartu skor gelap --- */
  card: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: 20,
    position: "relative",
    overflow: "hidden",
  },
  cardBody: {
    position: "absolute",
    top: 0,
    left: 0,
    width: CARD_W,
    height: CARD_H,
    padding: 22,
    display: "flex",
    flexDirection: "column",
  },
  cardLabel: {
    fontFamily: F,
    fontWeight: 700,
    fontSize: 7,
    letterSpacing: 2.4,
    color: CYAN,
    textTransform: "uppercase",
  },
  cardScore: {
    fontFamily: F,
    fontWeight: 700,
    fontSize: 66,
    color: WHITE,
    lineHeight: 1,
    marginTop: 10,
  },
  cardOutOf: {
    fontFamily: F,
    fontWeight: 500,
    fontSize: 8,
    color: "#bfdbfe",
    marginTop: 2,
  },
  cardDivider: {
    height: 0.8,
    backgroundColor: "rgba(255,255,255,0.16)",
    marginVertical: 16,
  },
  cardSmall: {
    fontFamily: F,
    fontWeight: 600,
    fontSize: 6,
    letterSpacing: 1.6,
    color: SKY,
    textTransform: "uppercase",
  },
  levelRow: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
  },
  levelCode: {
    fontFamily: F,
    fontWeight: 700,
    fontSize: 26,
    color: WHITE,
    lineHeight: 1,
  },
  levelPill: {
    marginLeft: 10,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 9,
    fontFamily: F,
    fontWeight: 600,
    fontSize: 7.5,
    color: "#e0f2fe",
  },
  cardFoot: {
    fontFamily: F,
    fontWeight: 500,
    fontSize: 6,
    letterSpacing: 1,
    color: SKY,
    marginTop: "auto",
  },

  /* --- Kaki: tanda tangan, tanggal, verifikasi --- */
  footer: {
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginTop: "auto",
  },
  signBlock: { width: 196, display: "flex", flexDirection: "column" },
  // Tanda tangan sedikit menimpa garis (seperti ditandatangani sungguhan) dan
  // digeser ke kanan supaya goresan turunnya jatuh di luar teks nama.
  signImage: {
    height: 66,
    objectFit: "contain",
    alignSelf: "flex-start",
    marginLeft: 66,
    marginBottom: -11,
  },
  signSpacer: { height: 55 },
  signLine: {
    height: 1,
    width: 176,
    backgroundColor: "#94a3b8",
    marginBottom: 6,
  },
  footLabel: {
    fontFamily: F,
    fontWeight: 700,
    fontSize: 6,
    letterSpacing: 1.6,
    color: BLUE,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  footValue: { fontFamily: F, fontWeight: 700, fontSize: 10, color: INK },
  footSub: {
    fontFamily: F,
    fontWeight: 500,
    fontSize: 7.2,
    color: GRAY,
    marginTop: 1.5,
  },

  verifyRow: { display: "flex", flexDirection: "row", alignItems: "center" },
  qrBox: {
    borderWidth: 0.8,
    borderColor: LINE,
    borderRadius: 10,
    padding: 6,
    backgroundColor: WHITE,
  },
  qr: { width: 60, height: 60 },
  verifyText: { marginLeft: 10, width: 128 },
  verifyUrl: {
    fontFamily: F,
    fontWeight: 600,
    fontSize: 6.6,
    color: INK,
    marginTop: 3,
    lineHeight: 1.4,
  },
  verifyPath: {
    fontFamily: F,
    fontWeight: 500,
    fontSize: 6.2,
    color: GRAY,
    lineHeight: 1.4,
  },

  disclaimer: {
    fontFamily: F,
    fontWeight: 400,
    fontSize: 5.8,
    color: "#94a3b8",
    marginTop: 14,
    lineHeight: 1.5,
  },
};

const styles = StyleSheet.create(withNoLigatures(rawStyles));

/** Nama panjang mengecil otomatis supaya tetap satu-dua baris rapi. */
function nameFontSize(name: string): number {
  const n = name.length;
  if (n <= 14) return 44;
  if (n <= 20) return 37;
  if (n <= 28) return 31;
  if (n <= 38) return 25;
  return 21;
}

/** Emblem: cakram bergradasi biru dengan petir putih — sama dengan logo situs. */
function BoltEmblem({ size = 34 }: { size?: number }) {
  const r = size / 2;
  const boltSize = size * 0.5;
  const offset = (size - boltSize) / 2;
  const scale = boltSize / 16;
  return (
    <Svg width={size} height={size}>
      <Defs>
        <LinearGradient id="emblemGrad" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={ROYAL} />
          <Stop offset="1" stopColor={BLUE_BRIGHT} />
        </LinearGradient>
      </Defs>
      <Circle cx={r} cy={r} r={r} fill="url(#emblemGrad)" />
      <Path
        d={BOLT_PATH}
        fill={WHITE}
        transform={`translate(${offset}, ${offset}) scale(${scale})`}
      />
    </Svg>
  );
}

/** Latar halaman: bingkai tipis, strip gradasi kiri, pendar lembut, garis & titik "teknis". */
function PageBackground() {
  const dots = [];
  for (let row = 0; row < 9; row += 1) {
    for (let col = 0; col < 2; col += 1) {
      dots.push({ x: 26 + col * 10, y: 236 + row * 10 });
    }
  }
  // Dibungkus View absolut: posisi absolut langsung di <Svg> tidak
  // dihormati di tingkat Page, sehingga SVG ikut mengalir dan mendorong
  // seluruh isi sertifikat ke halaman kedua.
  return (
    <View
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: PAGE_W,
        height: PAGE_H,
      }}
    >
      <Svg width={PAGE_W} height={PAGE_H}>
        <Defs>
          <LinearGradient id="stripGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={NAVY} />
            <Stop offset="0.55" stopColor={BLUE} />
            <Stop offset="1" stopColor={CYAN} />
          </LinearGradient>
          <LinearGradient id="glowGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={CYAN} />
            <Stop offset="1" stopColor={BLUE} />
          </LinearGradient>
        </Defs>

        {/* Pendar gradasi di pojok — kesan modern tanpa memakan tinta banyak. */}
        <Circle
          cx={PAGE_W - 10}
          cy={-30}
          r={220}
          fill="url(#glowGrad)"
          opacity={0.09}
        />
        <Circle cx={PAGE_W + 30} cy={40} r={120} fill={CYAN} opacity={0.08} />
        <Circle
          cx={90}
          cy={PAGE_H + 70}
          r={190}
          fill="url(#glowGrad)"
          opacity={0.06}
        />

        {/* Bingkai dalam tipis. */}
        <Rect
          x={16}
          y={16}
          width={PAGE_W - 32}
          height={PAGE_H - 32}
          rx={16}
          fill="none"
          stroke={LINE}
          strokeWidth={0.8}
        />

        {/* Strip gradasi vertikal di tepi kiri. */}
        <Rect
          x={16}
          y={70}
          width={4}
          height={PAGE_H - 140}
          rx={2}
          fill="url(#stripGrad)"
        />

        {/* Garis diagonal tipis di pojok kanan-bawah. */}
        <Line
          x1={PAGE_W - 16}
          y1={PAGE_H - 150}
          x2={PAGE_W - 150}
          y2={PAGE_H - 16}
          stroke={BLUE}
          strokeWidth={0.6}
          opacity={0.14}
        />
        <Line
          x1={PAGE_W - 16}
          y1={PAGE_H - 120}
          x2={PAGE_W - 120}
          y2={PAGE_H - 16}
          stroke={CYAN}
          strokeWidth={0.6}
          opacity={0.22}
        />

        {/* Kisi titik kecil dekat strip kiri. */}
        {dots.map((d, i) => (
          <Circle
            key={i}
            cx={d.x}
            cy={d.y}
            r={0.8}
            fill={BLUE}
            opacity={0.25}
          />
        ))}
      </Svg>
    </View>
  );
}

/** Garis bawah nama: batang gradasi biru → cyan dengan titik aksen. */
function NameUnderline() {
  return (
    <Svg width={150} height={6} style={{ marginTop: 12 }}>
      <Defs>
        <LinearGradient id="underlineGrad" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={BLUE} />
          <Stop offset="1" stopColor={CYAN} />
        </LinearGradient>
      </Defs>
      <Rect
        x={0}
        y={1}
        width={118}
        height={4}
        rx={2}
        fill="url(#underlineGrad)"
      />
      <Circle cx={128} cy={3} r={2} fill={CYAN} />
      <Circle cx={137} cy={3} r={1.4} fill={CYAN} opacity={0.5} />
    </Svg>
  );
}

function ScoreBar({
  value,
  max,
  id,
}: {
  value: number;
  max: number;
  id: string;
}) {
  const width = 116;
  const fill = Math.max(4, Math.min(1, value / max) * width);
  return (
    <Svg width={width} height={4}>
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={BLUE} />
          <Stop offset="1" stopColor={CYAN} />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width={width} height={4} rx={2} fill={LINE} />
      <Rect x={0} y={0} width={fill} height={4} rx={2} fill={`url(#${id})`} />
    </Svg>
  );
}

/** Latar kartu skor: gradasi navy, pendar cyan, watermark petir, titik-titik. */
function CardBackground() {
  const dots = [];
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 6; col += 1) {
      dots.push({ x: CARD_W - 70 + col * 9, y: CARD_H - 44 + row * 9 });
    }
  }
  return (
    <Svg
      width={CARD_W}
      height={CARD_H}
      style={{ position: "absolute", top: 0, left: 0 }}
    >
      <Defs>
        <LinearGradient id="cardGrad" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={INK} />
          <Stop offset="0.6" stopColor={NAVY} />
          <Stop offset="1" stopColor={ROYAL} />
        </LinearGradient>
      </Defs>
      <Rect
        x={0}
        y={0}
        width={CARD_W}
        height={CARD_H}
        rx={20}
        fill="url(#cardGrad)"
      />
      <Circle cx={CARD_W + 10} cy={-10} r={110} fill={CYAN} opacity={0.18} />
      <Circle cx={CARD_W - 10} cy={20} r={60} fill={CYAN} opacity={0.12} />
      <Path
        d={BOLT_PATH}
        fill={WHITE}
        opacity={0.06}
        transform={`translate(${CARD_W - 120}, 60) rotate(-10) scale(9)`}
      />
      {dots.map((d, i) => (
        <Circle key={i} cx={d.x} cy={d.y} r={0.9} fill={WHITE} opacity={0.22} />
      ))}
    </Svg>
  );
}

function CertificateDocument({
  data,
  qrDataUrl,
}: {
  data: CertificatePdfData;
  qrDataUrl: string;
}) {
  // Server Vercel berjalan di UTC — tanggal wajib dihitung di zona WIB.
  const dateLabel = new Intl.DateTimeFormat("en-GB", {
    dateStyle: "long",
    timeZone: "Asia/Jakarta",
  }).format(data.completedAt);
  const level = cefrLevel(data.overallScore);
  const signatoryPosition = data.signatoryPosition.replace(/\s+/g, " ").trim();
  // URL tidak berspasi sehingga tidak bisa dipatah otomatis — pecah jadi
  // dua baris: domain, lalu path /verify/<nomor>.
  const verifyLabel = data.verifyUrl.replace(/^https?:\/\//, "");
  const slashAt = verifyLabel.indexOf("/");
  const verifyHost = slashAt > 0 ? verifyLabel.slice(0, slashAt) : verifyLabel;
  const verifyPath = slashAt > 0 ? verifyLabel.slice(slashAt) : "";
  const signatureSrc = data.signaturePng
    ? `data:image/png;base64,${data.signaturePng.toString("base64")}`
    : null;

  const sections = [
    {
      key: "L",
      label: "Listening",
      value: data.listeningScaled,
      max: MAX_SECTION_SCORE.LISTENING,
    },
    {
      key: "S",
      label: "Structure",
      value: data.structureScaled,
      max: MAX_SECTION_SCORE.STRUCTURE,
    },
    {
      key: "R",
      label: "Reading",
      value: data.readingScaled,
      max: MAX_SECTION_SCORE.READING,
    },
  ];

  return (
    <Document
      title={`Certificate ${data.certificateNumber}`}
      author={data.institutionName}
    >
      <Page size="A4" orientation="landscape" style={styles.page} wrap={false}>
        <PageBackground />
        <View style={styles.frame}>
          {/* Kepala */}
          <View style={styles.header}>
            <View style={styles.brandRow}>
              <BoltEmblem />
              <View>
                <Text style={styles.brandName}>
                  {data.institutionName.toUpperCase()}
                </Text>
                <Text style={styles.brandSub}>
                  English Proficiency Assessment
                </Text>
              </View>
            </View>
            <View style={styles.idChip}>
              <Text style={styles.idLabel}>Certificate ID</Text>
              <Text style={styles.idValue}>{data.certificateNumber}</Text>
            </View>
          </View>

          {/* Isi utama */}
          <View style={styles.main}>
            <View style={styles.left}>
              <Text style={styles.eyebrow}>Certificate of Achievement</Text>
              <Text style={styles.certifies}>This is proudly presented to</Text>
              <Text
                style={[
                  styles.name,
                  { fontSize: nameFontSize(data.participantName) },
                ]}
              >
                {data.participantName}
              </Text>
              <NameUnderline />

              <Text style={styles.description}>
                for successfully completing the English proficiency assessment
                administered by{" "}
                <Text style={styles.strong}>{data.institutionName}</Text>,
                demonstrating an estimated level of{" "}
                <Text style={styles.strong}>
                  CEFR {level.code} — {level.labelEn}
                </Text>
                .
              </Text>

              <View style={styles.sections}>
                {sections.map((s) => (
                  <View key={s.key} style={styles.sectionCard}>
                    <Text style={styles.sectionLabel}>{s.label}</Text>
                    <View style={styles.sectionValueRow}>
                      <Text style={styles.sectionValue}>{s.value}</Text>
                      <Text style={styles.sectionMax}>/ {s.max}</Text>
                    </View>
                    <ScoreBar value={s.value} max={s.max} id={`bar${s.key}`} />
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.card}>
              <CardBackground />
              <View style={styles.cardBody}>
                <Text style={styles.cardLabel}>Overall Score</Text>
                <Text style={styles.cardScore}>{data.overallScore}</Text>
                <Text style={styles.cardOutOf}>out of {MAX_TOTAL_SCORE}</Text>
                <View style={styles.cardDivider} />
                <Text style={styles.cardSmall}>Estimated CEFR Level</Text>
                <View style={styles.levelRow}>
                  <Text style={styles.levelCode}>{level.code}</Text>
                  <Text style={styles.levelPill}>{level.labelEn}</Text>
                </View>
                <Text style={styles.cardFoot}>
                  TOEFL ITP FORMAT · PREDICTION TEST
                </Text>
              </View>
            </View>
          </View>

          {/* Kaki */}
          <View style={styles.footer}>
            {/* Garis tanda tangan selalu digambar: kalau gambar tanda tangan
              belum ada, sertifikat tetap seimbang dan bisa ditandatangani
              manual setelah dicetak. */}
            <View style={styles.signBlock}>
              {signatureSrc ? (
                // eslint-disable-next-line jsx-a11y/alt-text
                <Image src={signatureSrc} style={styles.signImage} />
              ) : (
                <View style={styles.signSpacer} />
              )}
              <View style={styles.signLine} />
              {data.signatoryName ? (
                <>
                  <Text style={styles.footValue}>{data.signatoryName}</Text>
                  <Text style={styles.footSub}>{signatoryPosition}</Text>
                </>
              ) : (
                <Text style={styles.footLabel}>Authorized Signature</Text>
              )}
            </View>

            <View>
              <Text style={styles.footLabel}>Date Issued</Text>
              <Text style={styles.footValue}>{dateLabel}</Text>
              <Text style={styles.footSub}>{data.institutionName}</Text>
            </View>

            <View style={styles.verifyRow}>
              <View style={styles.qrBox}>
                {/* eslint-disable-next-line jsx-a11y/alt-text */}
                <Image src={qrDataUrl} style={styles.qr} />
              </View>
              <View style={styles.verifyText}>
                <Text style={styles.footLabel}>Scan to verify</Text>
                <Text style={styles.footSub}>Check authenticity at</Text>
                <Text style={styles.verifyUrl}>{verifyHost}</Text>
                {verifyPath && (
                  <Text style={styles.verifyPath}>{verifyPath}</Text>
                )}
              </View>
            </View>
          </View>

          <Text style={styles.disclaimer}>
            This certificate records the result of a TOEFL-style prediction test
            administered by {data.institutionName}. It is a
            prediction/simulation result and is not an official TOEFL score
            report issued by ETS.
          </Text>
        </View>
      </Page>
    </Document>
  );
}

export async function renderCertificatePdf(
  data: CertificatePdfData,
): Promise<Buffer> {
  registerFonts();
  const qrDataUrl = await QRCode.toDataURL(data.verifyUrl, {
    margin: 0,
    width: 300,
    color: { dark: INK, light: "#00000000" },
  });
  const buffer = await renderToBuffer(
    <CertificateDocument data={data} qrDataUrl={qrDataUrl} />,
  );
  return Buffer.from(buffer);
}
