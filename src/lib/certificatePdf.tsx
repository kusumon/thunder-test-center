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
  Defs,
  LinearGradient,
  Stop,
  Font,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import type { Style } from "@react-pdf/stylesheet";
import QRCode from "qrcode";

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

/* ------------------------- Palet biru-putih ------------------------- */
const INK = "#0f172a";
const NAVY = "#1e3a8a";
const BLUE = "#2563eb";
const BLUE_BRIGHT = "#3b82f6";
const CYAN = "#22d3ee";
const BLUE_LINE = "#dbeafe";
const GRAY = "#64748b";
const WHITE = "#ffffff";

const PAGE_W = 841.89;
const PAGE_H = 595.28;
const PANEL_W = 246;

/** Bentuk petir (Bootstrap Icons `lightning-fill`, lisensi MIT), viewBox 16x16. */
const BOLT_PATH =
  "M5.52.359A.5.5 0 0 1 6 0h4a.5.5 0 0 1 .474.658L8.694 6H12.5a.5.5 0 0 1 .395.807l-7 9a.5.5 0 0 1-.873-.454L6.823 9.5H3.5a.5.5 0 0 1-.48-.641l2.5-8.5z";

/**
 * Sisipkan fontFeatureSettings ke tiap style bertipografi. Ligature GSUB
 * ("fi", "Th") membuat fontkit salah menghitung indeks glyph saat wrapping
 * sehingga huruf hilang di tengah kata ("Certificate" → "Certifcate").
 */
const NO_LIGATURES = { liga: false, dlig: false, clig: false, calt: false, rlig: false };

function withNoLigatures<T extends Record<string, Style>>(raw: T): T {
  return Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [
      key,
      value.fontFamily ? { ...value, fontFeatureSettings: NO_LIGATURES } : value,
    ]),
  ) as T;
}

const rawStyles: Record<string, Style> = {
  page: {
    backgroundColor: WHITE,
    fontFamily: "Montserrat",
    display: "flex",
    flexDirection: "row",
  },

  /* --- Kolom kiri: konten utama, rata kiri (bukan simetris/klasik) --- */
  left: {
    width: PAGE_W - PANEL_W,
    height: PAGE_H,
    paddingTop: 46,
    paddingBottom: 28,
    paddingLeft: 56,
    paddingRight: 36,
    display: "flex",
    flexDirection: "column",
  },
  eyebrow: {
    fontFamily: "Montserrat",
    fontWeight: 600,
    fontSize: 9,
    letterSpacing: 3,
    color: BLUE,
    textTransform: "uppercase",
  },
  name: {
    fontFamily: "Montserrat",
    fontWeight: 700,
    fontSize: 38,
    color: INK,
    marginTop: 10,
    maxWidth: 480,
  },
  ruleRow: { display: "flex", flexDirection: "row", marginTop: 14 },
  ruleBlue: { width: 46, height: 4, backgroundColor: BLUE, borderRadius: 2 },
  ruleCyan: { width: 14, height: 4, backgroundColor: CYAN, borderRadius: 2, marginLeft: 5 },

  lead: {
    fontFamily: "Montserrat",
    fontWeight: 400,
    fontSize: 10,
    color: GRAY,
    marginTop: 20,
  },
  scoreNumber: {
    fontFamily: "Montserrat",
    fontWeight: 700,
    fontSize: 68,
    color: BLUE,
    marginTop: 2,
  },
  scoreLabel: {
    fontFamily: "Montserrat",
    fontWeight: 600,
    fontSize: 8.5,
    letterSpacing: 2,
    color: NAVY,
    textTransform: "uppercase",
    marginTop: -4,
  },
  scoreCaption: {
    fontFamily: "Montserrat",
    fontWeight: 500,
    fontSize: 6.5,
    letterSpacing: 0.8,
    color: GRAY,
    textTransform: "uppercase",
    marginTop: 3,
  },

  statsRow: { display: "flex", flexDirection: "row", alignItems: "center", marginTop: 26 },
  statBox: { display: "flex", flexDirection: "column", paddingRight: 22 },
  statValue: { fontFamily: "Montserrat", fontWeight: 700, fontSize: 19, color: INK },
  statLabel: {
    fontFamily: "Montserrat",
    fontWeight: 500,
    fontSize: 6.8,
    letterSpacing: 0.6,
    color: GRAY,
    textTransform: "uppercase",
    marginTop: 3,
  },
  statDivider: { width: 1, height: 30, backgroundColor: BLUE_LINE, marginRight: 22 },

  footerRow: {
    display: "flex",
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 64,
    marginTop: 72,
  },
  footerLabel: {
    fontFamily: "Montserrat",
    fontWeight: 600,
    fontSize: 6.5,
    letterSpacing: 1.6,
    color: BLUE,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  footerValue: { fontFamily: "Montserrat", fontWeight: 700, fontSize: 10.5, color: INK },
  footerSub: { fontFamily: "Montserrat", fontWeight: 400, fontSize: 7.5, color: GRAY, marginTop: 1 },
  signatureLine: { height: 1, width: 128, backgroundColor: BLUE_LINE, marginBottom: 6 },

  disclaimer: {
    fontFamily: "Montserrat",
    fontWeight: 400,
    fontSize: 6.2,
    color: GRAY,
    marginTop: 14,
    maxWidth: 500,
    lineHeight: 1.5,
  },

  /* --- Panel kanan: identitas penerbit, gradasi navy → biru --- */
  panel: {
    width: PANEL_W,
    height: PAGE_H,
    position: "relative",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 40,
  },
  panelName: {
    fontFamily: "Montserrat",
    fontWeight: 700,
    fontSize: 15,
    letterSpacing: 1.6,
    color: WHITE,
    textAlign: "center",
    textTransform: "uppercase",
    marginTop: 14,
    maxWidth: 180,
  },
  panelSub: {
    fontFamily: "Montserrat",
    fontWeight: 500,
    fontSize: 6.5,
    letterSpacing: 1.6,
    color: "#bfdbfe",
    textAlign: "center",
    textTransform: "uppercase",
    marginTop: 5,
  },
  qrWrap: { backgroundColor: WHITE, borderRadius: 10, padding: 8 },
  qr: { width: 66, height: 66 },
  panelCertLabel: {
    fontFamily: "Montserrat",
    fontWeight: 600,
    fontSize: 6,
    letterSpacing: 1.4,
    color: "#bfdbfe",
    textTransform: "uppercase",
    marginTop: 10,
  },
  panelCertNumber: {
    fontFamily: "Montserrat",
    fontWeight: 700,
    fontSize: 9.5,
    color: WHITE,
    marginTop: 2,
  },
};

const styles = StyleSheet.create(withNoLigatures(rawStyles));

/** Emblem petir: lingkaran putih dengan bilah petir biru di tengahnya. */
function BoltEmblem({ size = 52 }: { size?: number }) {
  const r = size / 2;
  const boltSize = size * 0.48;
  const offset = (size - boltSize) / 2;
  const scale = boltSize / 16;
  return (
    <Svg width={size} height={size}>
      <Circle cx={r} cy={r} r={r - 1} fill={WHITE} />
      <Path d={BOLT_PATH} fill={BLUE} transform={`translate(${offset}, ${offset}) scale(${scale})`} />
    </Svg>
  );
}

/**
 * Dekorasi panel kanan: gradasi, sudut terpotong diagonal (aksen
 * "futuristik"), bilah petir raksasa transparan sebagai watermark, dan
 * pola titik teknis di bagian bawah.
 */
function PanelBackground() {
  const dots = [];
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      dots.push({ x: 26 + col * 14, y: 372 + row * 13 });
    }
  }

  return (
    <Svg
      width={PANEL_W}
      height={PAGE_H}
      style={{ position: "absolute", top: 0, left: 0 }}
    >
      <Defs>
        <LinearGradient id="panelGradient" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={NAVY} />
          <Stop offset="1" stopColor={BLUE_BRIGHT} />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width={PANEL_W} height={PAGE_H} fill="url(#panelGradient)" />

      {/* Sudut terpotong di kiri-atas: aksen geometris, bukan sekadar kotak polos. */}
      <Path d="M0,0 L58,0 L0,58 Z" fill={WHITE} opacity={0.06} />
      {/* Aksen cyan di kanan-bawah, kontras tipis dari palet biru dasar. */}
      <Path d={`M${PANEL_W},${PAGE_H} L${PANEL_W},${PAGE_H - 70} L${PANEL_W - 70},${PAGE_H} Z`} fill={CYAN} opacity={0.14} />

      {/* Watermark petir raksasa, nyaris tak terlihat, sekadar tekstur. */}
      <Path
        d={BOLT_PATH}
        fill={WHITE}
        opacity={0.05}
        transform={`translate(-30, 130) rotate(-8) scale(11)`}
      />

      {/* Kisi titik kecil — sentuhan "teknis" di area kosong bawah panel. */}
      {dots.map((d, i) => (
        <Circle key={i} cx={d.x} cy={d.y} r={0.9} fill={WHITE} opacity={0.22} />
      ))}
    </Svg>
  );
}

function CertificateDocument({ data, qrDataUrl }: { data: CertificatePdfData; qrDataUrl: string }) {
  const dateLabel = new Intl.DateTimeFormat("id-ID", { dateStyle: "long" }).format(data.completedAt);

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.left}>
          <Text style={styles.eyebrow}>Certificate of Achievement</Text>
          <Text style={styles.name}>{data.participantName}</Text>
          <View style={styles.ruleRow}>
            <View style={styles.ruleBlue} />
            <View style={styles.ruleCyan} />
          </View>

          <Text style={styles.lead}>has achieved an overall score of</Text>
          <Text style={styles.scoreNumber}>{data.overallScore}</Text>
          <Text style={styles.scoreLabel}>Overall Score</Text>
          <Text style={styles.scoreCaption}>TOEFL Prediction Test · ITP Format</Text>

          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{data.listeningScaled}</Text>
              <Text style={styles.statLabel}>Listening</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{data.structureScaled}</Text>
              <Text style={styles.statLabel}>Structure &amp; Written</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{data.readingScaled}</Text>
              <Text style={styles.statLabel}>Reading</Text>
            </View>
          </View>

          <View style={styles.footerRow}>
            <View>
              <Text style={styles.footerLabel}>Date Issued</Text>
              <Text style={styles.footerValue}>{dateLabel}</Text>
            </View>
            {/* Garis tanda tangan selalu digambar: kalau penandatangan belum
                dikonfigurasi, sertifikat tetap seimbang dan masih bisa
                ditandatangani manual setelah dicetak. */}
            <View>
              <View style={styles.signatureLine} />
              {data.signatoryName ? (
                <>
                  <Text style={styles.footerValue}>{data.signatoryName}</Text>
                  <Text style={styles.footerSub}>{data.signatoryPosition}</Text>
                </>
              ) : (
                <Text style={styles.footerLabel}>Authorized Signature</Text>
              )}
            </View>
          </View>

          <Text style={styles.disclaimer}>
            This certificate records the result of a TOEFL Prediction Test administered by{" "}
            {data.institutionName}. It is a prediction/simulation result and is not an official TOEFL
            score report issued by ETS. Verify the authenticity of this certificate at{" "}
            {data.verifyUrl}
          </Text>
        </View>

        <View style={styles.panel}>
          <PanelBackground />

          <View style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <BoltEmblem />
            <Text style={styles.panelName}>{data.institutionName}</Text>
            <Text style={styles.panelSub}>English Proficiency Assessment</Text>
          </View>

          <View style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <View style={styles.qrWrap}>
              {/* eslint-disable-next-line jsx-a11y/alt-text */}
              <Image src={qrDataUrl} style={styles.qr} />
            </View>
            <Text style={styles.panelCertLabel}>Certificate No.</Text>
            <Text style={styles.panelCertNumber}>{data.certificateNumber}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}

export async function renderCertificatePdf(data: CertificatePdfData): Promise<Buffer> {
  registerFonts();
  const qrDataUrl = await QRCode.toDataURL(data.verifyUrl, {
    margin: 0,
    width: 300,
    color: { dark: NAVY, light: "#00000000" },
  });
  const buffer = await renderToBuffer(<CertificateDocument data={data} qrDataUrl={qrDataUrl} />);
  return Buffer.from(buffer);
}
