/**
 * Seed SEMUA paket soal yang ditemukan di content/ — SRS §17, §19.
 *
 * Setiap subfolder content/<kode-paket>/ berisi questions.json (hasil
 * scripts/parse-question-bank.mjs), config.json, dan score-conversion.json.
 * Folder itu tidak dipublikasikan sebagai direktori statis karena memuat
 * kunci jawaban.
 *
 * Fase 4 menambah dukungan banyak paket setara (SRS §19: "randomly assign
 * one active equivalent package to a new attempt") — cukup taruh paket
 * baru di folder content/ lain, jalankan skrip ini, dan attempt baru akan
 * diacak di antara semua paket aktif tanpa perlu ubah kode.
 *
 * PENTING — jangan pernah kembalikan pola delete-lalu-create untuk
 * section/question/passage: versi Fase 1-3 melakukan itu
 * (`section.deleteMany` lalu `section.create`), dan karena Question →
 * onDelete:Cascade dari Section, serta AttemptAnswer → onDelete:Cascade
 * dari Question (begitu juga AttemptSectionSession dari Section), setiap
 * `npm run db:seed` ulang diam-diam MENGHAPUS seluruh riwayat jawaban dan
 * waktu section milik attempt yang SUDAH SELESAI. Skor akhir di baris
 * Attempt tetap utuh (tidak lewat relasi itu), tapi rincian per-soal
 * lenyap tanpa peringatan. Ini pernah benar-benar terjadi ke data peserta
 * asli saat pengembangan (lihat migrasi passage_stable_identity).
 *
 * Sebagai gantinya, semuanya di-upsert lewat kunci alami yang stabil
 * (nomor soal, posisi passage, huruf pilihan) supaya ID baris lama tetap
 * sama antar-reseed dan attempt lama tidak pernah kehilangan relasinya.
 * Soal yang dihapus dari sumber konten di-nonaktifkan (`isActive: false`),
 * bukan dihapus — riwayat attempt lama yang menjawabnya tetap valid.
 */
import "dotenv/config";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import type { SectionType, QuestionType } from "../src/generated/prisma/client";

const CONTENT_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "content");

type BankQuestion = {
  number: number;
  questionType: QuestionType;
  stem: string;
  choices: Record<string, string>;
  correctChoiceKey: string;
};

type BankSection = {
  type: SectionType;
  title: string;
  position: number;
  questions: BankQuestion[];
  passages: { position: number; title: string; body: string; questions: BankQuestion[] }[];
};

type Bank = {
  package: { code: string; name: string; description: string };
  sections: BankSection[];
};

type Config = {
  audioFile: string;
  sections: {
    type: SectionType;
    position: number;
    durationSeconds: number;
    instructions: string;
    strictAudio: boolean;
  }[];
};

type Conversion = {
  tables: Record<SectionType, Record<string, number>>;
};

function readJson<T>(dir: string, file: string): T {
  return JSON.parse(readFileSync(join(dir, file), "utf8")) as T;
}

/** Slug folder HARUS sama dengan yang dipakai parse-question-bank.mjs dan audioStorage.ts. */
function slugifyPackageCode(code: string): string {
  return code.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL belum diisi. Salin .env.example menjadi .env.");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

/**
 * Upsert satu soal beserta empat pilihannya, dikunci pada (sectionId,
 * number) — bukan dibuat baru setiap saat — supaya AttemptAnswer lama yang
 * menunjuk ke baris ini tetap valid.
 */
async function upsertQuestion(
  sectionId: string,
  passageId: string | null,
  question: BankQuestion,
  position: number,
) {
  const saved = await prisma.question.upsert({
    where: { sectionId_number: { sectionId, number: question.number } },
    update: {
      passageId,
      questionType: question.questionType,
      stem: question.stem,
      correctChoiceKey: question.correctChoiceKey,
      position,
      isActive: true,
    },
    create: {
      sectionId,
      passageId,
      number: question.number,
      questionType: question.questionType,
      stem: question.stem,
      correctChoiceKey: question.correctChoiceKey,
      position,
    },
  });

  for (const [index, key] of (["A", "B", "C", "D"] as const).entries()) {
    await prisma.choice.upsert({
      where: { questionId_choiceKey: { questionId: saved.id, choiceKey: key } },
      update: { text: question.choices[key], position: index + 1 },
      create: { questionId: saved.id, choiceKey: key, text: question.choices[key], position: index + 1 },
    });
  }

  return saved;
}

function bankPassageCount(section: BankSection) {
  return section.passages.length;
}

async function seedPackage(dir: string) {
  const bank = readJson<Bank>(dir, "questions.json");
  const config = readJson<Config>(dir, "config.json");
  const conversion = readJson<Conversion>(dir, "score-conversion.json");

  const expectedSlug = slugifyPackageCode(bank.package.code);
  const actualSlug = dir.split(/[\\/]/).pop();
  if (actualSlug !== expectedSlug) {
    throw new Error(
      `Folder "${actualSlug}" tidak cocok dengan slug kode paket "${bank.package.code}" ` +
        `(seharusnya "${expectedSlug}"). Audio Listening paket ini akan gagal dimuat kalau ini dibiarkan.`,
    );
  }

  const testPackage = await prisma.testPackage.upsert({
    where: { code: bank.package.code },
    update: { name: bank.package.name, description: bank.package.description },
    create: {
      code: bank.package.code,
      name: bank.package.name,
      description: bank.package.description,
      isActive: true,
    },
  });

  for (const bankSection of bank.sections) {
    const sectionConfig = config.sections.find((s) => s.type === bankSection.type);
    if (!sectionConfig) throw new Error(`${dir}/config.json tidak memuat section ${bankSection.type}`);

    const section = await prisma.section.upsert({
      where: { testPackageId_type: { testPackageId: testPackage.id, type: bankSection.type } },
      update: {
        title: bankSection.title,
        position: bankSection.position,
        durationSeconds: sectionConfig.durationSeconds,
        instructions: sectionConfig.instructions,
        strictAudio: sectionConfig.strictAudio,
        audioAssetKey: bankSection.type === "LISTENING" ? config.audioFile : null,
      },
      create: {
        testPackageId: testPackage.id,
        type: bankSection.type,
        title: bankSection.title,
        position: bankSection.position,
        durationSeconds: sectionConfig.durationSeconds,
        instructions: sectionConfig.instructions,
        strictAudio: sectionConfig.strictAudio,
        audioAssetKey: bankSection.type === "LISTENING" ? config.audioFile : null,
      },
    });

    const seenQuestionNumbers = new Set<number>();
    let position = 0;

    for (const question of bankSection.questions) {
      position += 1;
      seenQuestionNumbers.add(question.number);
      await upsertQuestion(section.id, null, question, position);
    }

    for (const bankPassage of bankSection.passages) {
      const passage = await prisma.passage.upsert({
        where: { sectionId_position: { sectionId: section.id, position: bankPassage.position } },
        update: { title: bankPassage.title, body: bankPassage.body },
        create: {
          sectionId: section.id,
          title: bankPassage.title,
          body: bankPassage.body,
          position: bankPassage.position,
        },
      });
      for (const question of bankPassage.questions) {
        position += 1;
        seenQuestionNumbers.add(question.number);
        await upsertQuestion(section.id, passage.id, question, position);
      }
    }

    // Soal yang sudah tidak ada di sumber konten dinonaktifkan, bukan
    // dihapus — attempt lama yang pernah menjawabnya tetap punya baris
    // valid untuk ditinjau admin.
    const deactivated = await prisma.question.updateMany({
      where: { sectionId: section.id, number: { notIn: [...seenQuestionNumbers] } },
      data: { isActive: false },
    });
    if (deactivated.count > 0) {
      console.log(`  (${deactivated.count} soal lama dinonaktifkan, tidak lagi ada di sumber)`);
    }

    // Tabel konversi tidak direferensikan attempt manapun secara langsung
    // (skor sudah dibekukan di baris Attempt saat submit), jadi aman
    // ditulis ulang dari nol setiap kali.
    const table = conversion.tables[bankSection.type];
    await prisma.scoreConversionRule.deleteMany({
      where: { testPackageId: testPackage.id, sectionType: bankSection.type },
    });
    await prisma.scoreConversionRule.createMany({
      data: Object.entries(table).map(([rawScore, scaledScore]) => ({
        testPackageId: testPackage.id,
        sectionType: bankSection.type,
        rawScore: Number(rawScore),
        scaledScore,
      })),
    });

    const questionCount = await prisma.question.count({ where: { sectionId: section.id, isActive: true } });
    console.log(
      `  ${bankSection.type.padEnd(9)} ${String(questionCount).padStart(3)} soal | ` +
        `${bankPassageCount(bankSection)} passage | ` +
        `${Object.keys(table).length} baris konversi | ` +
        `${sectionConfig.durationSeconds / 60} menit`,
    );
  }

  console.log(`Paket "${testPackage.name}" (${testPackage.code}) siap.\n`);
}

async function main() {
  const packageDirs = readdirSync(CONTENT_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(CONTENT_ROOT, entry.name))
    .filter((dir) => existsSync(join(dir, "questions.json")));

  if (packageDirs.length === 0) {
    throw new Error(`Tidak ada paket ditemukan di ${CONTENT_ROOT}. Jalankan parse-question-bank.mjs dulu.`);
  }

  console.log(`Ditemukan ${packageDirs.length} paket di content/:\n`);
  for (const dir of packageDirs) {
    await seedPackage(dir);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
