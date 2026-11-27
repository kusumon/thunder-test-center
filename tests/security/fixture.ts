/**
 * Data uji untuk pentest (tests/security/pentest.mjs).
 *
 *   npx tsx tests/security/fixture.ts create   → buat data PENTEST, tulis .fixture.json
 *   npx tsx tests/security/fixture.ts cleanup  → hapus SEMUA data PENTEST
 *
 * Semua sesi peserta uji bernama "PENTEST ..." supaya bisa dibersihkan
 * tuntas (cascade ke attempt, jawaban, pesanan, sertifikat).
 */
import "dotenv/config";
import { randomBytes, createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
const hash = (t: string) => createHash("sha256").update(t).digest("hex");
const code = () => `TP-26-PT${randomBytes(3).toString("hex").toUpperCase().slice(0, 4)}`;

async function session(name: string) {
  const token = randomBytes(32).toString("hex");
  const s = await prisma.participantSession.create({ data: { displayName: name, sessionTokenHash: hash(token) } });
  return { token, id: s.id };
}

async function create() {
  const pkg = await prisma.testPackage.findFirstOrThrow({
    where: { isActive: true },
    include: { sections: { include: { questions: { where: { isActive: true }, take: 1, orderBy: { position: "asc" } } } } },
  });
  const sec = (t: string) => pkg.sections.find((s) => s.type === t)!;

  // A: korban, attempt baru. Nama sengaja berisi payload XSS (meniru sanitizer yang jebol).
  const A = await session("PENTEST A <img src=x onerror=alert(1)>");
  const attemptA = await prisma.attempt.create({
    data: {
      publicCode: code(),
      participantSessionId: A.id,
      testPackageId: pkg.id,
      participantNameSnapshot: "PENTEST A <img src=x onerror=alert(1)>",
    },
  });
  // B: penyerang, punya sesi sendiri tanpa attempt milik A.
  const B = await session("PENTEST B");

  // C: attempt selesai dengan pesanan BELUM dibayar & satu DITOLAK (uji gerbang PDF).
  const C = await session("PENTEST C");
  const mkDone = async () =>
    prisma.attempt.create({
      data: {
        publicCode: code(),
        participantSessionId: C.id,
        testPackageId: pkg.id,
        participantNameSnapshot: "PENTEST C",
        status: "COMPLETED",
        completedAt: new Date(),
        listeningScaled: 40,
        structureScaled: 40,
        readingScaled: 40,
        overallScore: 400,
      },
    });
  const claim = () => `TPC-PT${randomBytes(2).toString("hex").toUpperCase()}-${randomBytes(2).toString("hex").toUpperCase()}`;
  const unpaid = await prisma.certificateOrder.create({
    data: { attemptId: (await mkDone()).id, claimCode: claim(), amount: 75001, status: "MENUNGGU_PEMBAYARAN" },
  });
  const rejected = await prisma.certificateOrder.create({
    data: { attemptId: (await mkDone()).id, claimCode: claim(), amount: 75002, status: "DITOLAK", reviewNote: "uji" },
  });

  const fixture = {
    tokenA: A.token,
    tokenB: B.token,
    tokenC: C.token,
    codeA: attemptA.publicCode,
    listeningQuestionId: sec("LISTENING").questions[0].id,
    readingQuestionId: sec("READING").questions[0].id,
    unpaidClaim: unpaid.claimCode,
    rejectedClaim: rejected.claimCode,
  };
  writeFileSync(new URL("./.fixture.json", import.meta.url), JSON.stringify(fixture, null, 2));
  console.log("fixture dibuat:", { codeA: fixture.codeA, unpaid: fixture.unpaidClaim, rejected: fixture.rejectedClaim });
}

async function cleanup() {
  const { count } = await prisma.participantSession.deleteMany({ where: { displayName: { startsWith: "PENTEST" } } });
  const left = await prisma.attempt.count({ where: { participantNameSnapshot: { startsWith: "PENTEST" } } });
  console.log(`dibersihkan: ${count} sesi PENTEST (sisa attempt PENTEST: ${left})`);
}

(process.argv[2] === "cleanup" ? cleanup() : create()).finally(() => prisma.$disconnect());
