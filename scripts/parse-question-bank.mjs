/**
 * Mengubah bank soal Markdown menjadi JSON terstruktur untuk seeding database.
 *
 * Dipakai untuk mengimpor PAKET BARU (Fase 4, SRS §17/§19) — setiap paket
 * setara butuh 140 soal sendiri (50 Listening + 40 Structure + 50 Reading)
 * dalam format Markdown yang sama persis dengan
 * TOEFL_Practice_Test_Soal_dan_Kunci_Jawaban.md, supaya peserta yang dapat
 * paket berbeda tidak bisa saling membocorkan jawaban.
 *
 * Pemakaian:
 *   node scripts/parse-question-bank.mjs [sumberMarkdown] [kodePaket] [namaPaket]
 * Tanpa argumen, perilakunya sama seperti sebelumnya (paket TEST-01).
 *
 * File keluaran BERISI kunci jawaban, jadi folder content/ tidak boleh
 * dipublikasikan sebagai direktori statis (SRS §17, FR-022).
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const [sourceArg, packageCodeArg, packageNameArg] = process.argv.slice(2);
const SOURCE = sourceArg
  ? join(process.cwd(), sourceArg)
  : join(root, '..', 'TOEFL_Practice_Test_Soal_dan_Kunci_Jawaban.md');
const PACKAGE_CODE = packageCodeArg || 'TEST-01';
const PACKAGE_NAME = packageNameArg || 'TOEFL Prediction Test 01';
// Nama folder SELALU slug dari kode paket (huruf kecil, non-alfanumerik
// jadi "-"). audioStorage.ts menurunkan folder yang sama dari
// `testPackage.code` saat runtime — kalau dua sisi ini tidak konsisten,
// audio Listening paket itu diam-diam gagal dimuat.
const OUTPUT_DIR = join(root, 'content', PACKAGE_CODE.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
const OUTPUT = join(OUTPUT_DIR, 'questions.json');

mkdirSync(OUTPUT_DIR, { recursive: true });

/** Buang penanda markdown, rapikan spasi. */
function clean(text) {
  return text
    .replace(/\\\|/g, '|')
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Pecah dokumen jadi paragraf; baris yang ter-wrap disatukan kembali. */
function toParagraphs(raw) {
  return raw
    .split(/\r?\n\s*\r?\n/)
    .map((block) => block.split(/\r?\n/).map((line) => line.trim()).join(' ').trim())
    .filter(Boolean);
}

const paragraphs = toParagraphs(readFileSync(SOURCE, 'utf8'));

const RE_HEADING = /^(#{1,6})\s+(.*)$/;
const RE_QUESTION = /^\*\*(\d+)\.\*\*\s*(.*)$/;
const RE_CHOICE = /^\*\*([A-D])\.\*\*\s*(.*)$/;

/* ---------------------------------------------------------------- *
 * 1. Kunci jawaban diambil dari "Master Answer Key — All Sections". *
 * ---------------------------------------------------------------- */
function parseAnswerKeys() {
  const keys = { LISTENING: {}, STRUCTURE: {}, READING: {} };
  const bySubheading = {
    'listening comprehension': 'LISTENING',
    'structure & written expression': 'STRUCTURE',
    'reading comprehension': 'READING',
  };

  const start = paragraphs.findIndex((p) => /^#\s+Master Answer Key/.test(p));
  if (start === -1) throw new Error('Bagian "Master Answer Key" tidak ditemukan.');

  let current = null;
  for (const para of paragraphs.slice(start + 1)) {
    const heading = para.match(RE_HEADING);
    if (heading) {
      current = bySubheading[clean(heading[2]).toLowerCase()] ?? null;
      continue;
    }
    if (!current) continue;
    for (const [, number, key] of clean(para).matchAll(/(\d+)\.\s*([A-D])\b/g)) {
      keys[current][Number(number)] = key;
    }
  }
  return keys;
}

/* ------------------------------------------------------------------ *
 * 2. Soal + pilihan jawaban, dibaca per rentang paragraf tiap bagian. *
 * ------------------------------------------------------------------ */
function indexOfHeading(pattern, from = 0) {
  const offset = paragraphs.slice(from).findIndex((p) => pattern.test(p));
  if (offset === -1) throw new Error(`Heading tidak ditemukan: ${pattern}`);
  return from + offset;
}

/**
 * Baca soal dari rentang paragraf. Paragraf non-soal/non-pilihan (misalnya
 * kalimat pengantar) diabaikan selama belum ada soal yang dibuka.
 */
function collectQuestions(from, to, { questionType }) {
  const questions = [];
  let active = null;

  for (const para of paragraphs.slice(from, to)) {
    if (RE_HEADING.test(para)) continue;

    const question = para.match(RE_QUESTION);
    if (question) {
      const number = Number(question[1]);
      active = {
        number,
        questionType: typeof questionType === 'function' ? questionType(number) : questionType,
        stem: clean(question[2]),
        choices: {},
      };
      questions.push(active);
      continue;
    }

    const choice = para.match(RE_CHOICE);
    if (choice && active) {
      active.choices[choice[1]] = clean(choice[2]);
      continue;
    }

    // Lanjutan stem yang terpisah paragraf.
    if (active && Object.keys(active.choices).length === 0) {
      active.stem = clean(`${active.stem} ${para}`);
    }
  }
  return questions;
}

/* -------- Section 1 - Listening -------- */
const listeningStart = indexOfHeading(/^#\s+Section 1/);
const listeningKeyStart = indexOfHeading(/^#\s+Answer Key — Listening/, listeningStart);
const listeningQuestions = collectQuestions(listeningStart, listeningKeyStart, {
  questionType: 'MCQ',
});

/* -------- Section 2 - Structure -------- */
const structureStart = indexOfHeading(/^#\s+Section 2/);
const structureKeyStart = indexOfHeading(/^#\s+Answer Key — Structure/, structureStart);
const structureQuestions = collectQuestions(structureStart, structureKeyStart, {
  questionType: (n) => (n <= 15 ? 'MCQ' : 'ERROR_RECOGNITION'),
});

/* -------- Section 3 - Reading (bergrup per passage) -------- */
const readingStart = indexOfHeading(/^#\s+Section 3/);
const readingKeyStart = indexOfHeading(/^#\s+Answer Key — Reading/, readingStart);

const passageHeadings = [];
for (let i = readingStart; i < readingKeyStart; i += 1) {
  if (/^##\s+Passage\s+\d+/.test(paragraphs[i])) passageHeadings.push(i);
}

const passages = passageHeadings.map((headingIndex, order) => {
  const end = passageHeadings[order + 1] ?? readingKeyStart;
  const offset = paragraphs.slice(headingIndex, end).findIndex((p) => /^###\s+Questions/.test(p));
  if (offset === -1) {
    throw new Error(`Passage ${order + 1}: heading "### Questions" tidak ditemukan.`);
  }
  const bodyEnd = headingIndex + offset;

  const body = paragraphs
    .slice(headingIndex + 1, bodyEnd)
    .filter((p) => !RE_HEADING.test(p))
    .map(clean);

  return {
    position: order + 1,
    title: clean(paragraphs[headingIndex].replace(/^##\s+/, '')),
    body: body.join('\n\n'),
    questions: collectQuestions(bodyEnd, end, { questionType: 'MCQ' }),
  };
});

/* -------------------- 3. Gabungkan + validasi -------------------- */
const answerKeys = parseAnswerKeys();
const problems = [];

function attachKeys(questions, sectionType, expectedCount) {
  if (questions.length !== expectedCount) {
    problems.push(
      `${sectionType}: ditemukan ${questions.length} soal, seharusnya ${expectedCount}.`,
    );
  }
  return questions.map((question) => {
    const correct = answerKeys[sectionType][question.number];
    const choiceKeys = Object.keys(question.choices).sort().join('');

    if (choiceKeys !== 'ABCD') {
      problems.push(
        `${sectionType} no.${question.number}: pilihan jawaban "${choiceKeys}" tidak lengkap.`,
      );
    }
    if (!correct) {
      problems.push(`${sectionType} no.${question.number}: kunci jawaban tidak ditemukan.`);
    }
    if (!question.stem) {
      problems.push(`${sectionType} no.${question.number}: stem kosong.`);
    }
    return { ...question, correctChoiceKey: correct ?? null };
  });
}

const bank = {
  package: {
    code: PACKAGE_CODE,
    name: PACKAGE_NAME,
    description: 'Paket prediksi TOEFL ITP-style: 50 Listening, 40 Structure, 50 Reading.',
  },
  sections: [
    {
      type: 'LISTENING',
      title: 'Listening Comprehension',
      position: 1,
      questions: attachKeys(listeningQuestions, 'LISTENING', 50),
      passages: [],
    },
    {
      type: 'STRUCTURE',
      title: 'Structure & Written Expression',
      position: 2,
      questions: attachKeys(structureQuestions, 'STRUCTURE', 40),
      passages: [],
    },
    {
      type: 'READING',
      title: 'Reading Comprehension',
      position: 3,
      questions: [],
      passages: passages.map((passage) => ({
        position: passage.position,
        title: passage.title,
        body: passage.body,
        questions: attachKeys(passage.questions, 'READING', passage.questions.length),
      })),
    },
  ],
};

const readingCount = bank.sections[2].passages.reduce((n, p) => n + p.questions.length, 0);
if (readingCount !== 50) {
  problems.push(`READING: ditemukan ${readingCount} soal, seharusnya 50.`);
}

if (problems.length > 0) {
  console.error('Validasi gagal:');
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

writeFileSync(OUTPUT, `${JSON.stringify(bank, null, 2)}\n`, 'utf8');

console.log(`OK  Listening ${bank.sections[0].questions.length} soal`);
console.log(`OK  Structure ${bank.sections[1].questions.length} soal`);
console.log(`OK  Reading   ${readingCount} soal / ${bank.sections[2].passages.length} passage`);
console.log(`Tersimpan di ${OUTPUT}`);
