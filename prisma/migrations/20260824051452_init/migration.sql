-- CreateEnum
CREATE TYPE "SectionType" AS ENUM ('LISTENING', 'STRUCTURE', 'READING');

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('MCQ', 'ERROR_RECOGNITION');

-- CreateEnum
CREATE TYPE "AttemptStatus" AS ENUM ('CREATED', 'IN_PROGRESS', 'COMPLETED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "CertificateStatus" AS ENUM ('VALID', 'REVOKED');

-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('ADMIN', 'SUPERADMIN');

-- CreateTable
CREATE TABLE "participant_sessions" (
    "id" UUID NOT NULL,
    "display_name" VARCHAR(120) NOT NULL,
    "session_token_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "participant_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_packages" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "certificate_min_score" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "test_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sections" (
    "id" UUID NOT NULL,
    "test_package_id" UUID NOT NULL,
    "type" "SectionType" NOT NULL,
    "title" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "duration_seconds" INTEGER NOT NULL,
    "instructions" TEXT NOT NULL,
    "audio_asset_key" TEXT,
    "strict_audio" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "passages" (
    "id" UUID NOT NULL,
    "section_id" UUID NOT NULL,
    "title" TEXT,
    "body" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "passages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "questions" (
    "id" UUID NOT NULL,
    "section_id" UUID NOT NULL,
    "passage_id" UUID,
    "number" INTEGER NOT NULL,
    "question_type" "QuestionType" NOT NULL,
    "stem" TEXT NOT NULL,
    "correct_choice_key" CHAR(1) NOT NULL,
    "position" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "choices" (
    "id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "choice_key" CHAR(1) NOT NULL,
    "text" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "choices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "score_conversion_rules" (
    "id" UUID NOT NULL,
    "test_package_id" UUID NOT NULL,
    "section_type" "SectionType" NOT NULL,
    "raw_score" INTEGER NOT NULL,
    "scaled_score" INTEGER NOT NULL,

    CONSTRAINT "score_conversion_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attempts" (
    "id" UUID NOT NULL,
    "public_code" TEXT NOT NULL,
    "participant_session_id" UUID NOT NULL,
    "test_package_id" UUID NOT NULL,
    "participant_name_snapshot" VARCHAR(120) NOT NULL,
    "status" "AttemptStatus" NOT NULL DEFAULT 'CREATED',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "listening_raw" INTEGER,
    "listening_scaled" INTEGER,
    "structure_raw" INTEGER,
    "structure_scaled" INTEGER,
    "reading_raw" INTEGER,
    "reading_scaled" INTEGER,
    "overall_score" INTEGER,

    CONSTRAINT "attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attempt_section_sessions" (
    "id" UUID NOT NULL,
    "attempt_id" UUID NOT NULL,
    "section_id" UUID NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "submitted_at" TIMESTAMP(3),

    CONSTRAINT "attempt_section_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attempt_answers" (
    "id" UUID NOT NULL,
    "attempt_id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "selected_choice_key" CHAR(1) NOT NULL,
    "answered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_correct" BOOLEAN,

    CONSTRAINT "attempt_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "certificates" (
    "id" UUID NOT NULL,
    "certificate_number" TEXT NOT NULL,
    "sequence" SERIAL NOT NULL,
    "attempt_id" UUID NOT NULL,
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "CertificateStatus" NOT NULL DEFAULT 'VALID',
    "verification_token" TEXT NOT NULL,

    CONSTRAINT "certificates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "AdminRole" NOT NULL DEFAULT 'ADMIN',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "participant_sessions_session_token_hash_key" ON "participant_sessions"("session_token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "test_packages_code_key" ON "test_packages"("code");

-- CreateIndex
CREATE INDEX "sections_test_package_id_position_idx" ON "sections"("test_package_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "sections_test_package_id_type_key" ON "sections"("test_package_id", "type");

-- CreateIndex
CREATE INDEX "passages_section_id_position_idx" ON "passages"("section_id", "position");

-- CreateIndex
CREATE INDEX "questions_section_id_position_idx" ON "questions"("section_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "questions_section_id_number_key" ON "questions"("section_id", "number");

-- CreateIndex
CREATE INDEX "choices_question_id_position_idx" ON "choices"("question_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "choices_question_id_choice_key_key" ON "choices"("question_id", "choice_key");

-- CreateIndex
CREATE UNIQUE INDEX "score_conversion_rules_test_package_id_section_type_raw_sco_key" ON "score_conversion_rules"("test_package_id", "section_type", "raw_score");

-- CreateIndex
CREATE UNIQUE INDEX "attempts_public_code_key" ON "attempts"("public_code");

-- CreateIndex
CREATE INDEX "attempts_participant_session_id_started_at_idx" ON "attempts"("participant_session_id", "started_at");

-- CreateIndex
CREATE INDEX "attempts_status_completed_at_idx" ON "attempts"("status", "completed_at");

-- CreateIndex
CREATE UNIQUE INDEX "attempt_section_sessions_attempt_id_section_id_key" ON "attempt_section_sessions"("attempt_id", "section_id");

-- CreateIndex
CREATE INDEX "attempt_answers_attempt_id_idx" ON "attempt_answers"("attempt_id");

-- CreateIndex
CREATE UNIQUE INDEX "attempt_answers_attempt_id_question_id_key" ON "attempt_answers"("attempt_id", "question_id");

-- CreateIndex
CREATE UNIQUE INDEX "certificates_certificate_number_key" ON "certificates"("certificate_number");

-- CreateIndex
CREATE UNIQUE INDEX "certificates_sequence_key" ON "certificates"("sequence");

-- CreateIndex
CREATE UNIQUE INDEX "certificates_attempt_id_key" ON "certificates"("attempt_id");

-- CreateIndex
CREATE UNIQUE INDEX "certificates_verification_token_key" ON "certificates"("verification_token");

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_email_key" ON "admin_users"("email");

-- AddForeignKey
ALTER TABLE "sections" ADD CONSTRAINT "sections_test_package_id_fkey" FOREIGN KEY ("test_package_id") REFERENCES "test_packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "passages" ADD CONSTRAINT "passages_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_passage_id_fkey" FOREIGN KEY ("passage_id") REFERENCES "passages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "choices" ADD CONSTRAINT "choices_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "score_conversion_rules" ADD CONSTRAINT "score_conversion_rules_test_package_id_fkey" FOREIGN KEY ("test_package_id") REFERENCES "test_packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_participant_session_id_fkey" FOREIGN KEY ("participant_session_id") REFERENCES "participant_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_test_package_id_fkey" FOREIGN KEY ("test_package_id") REFERENCES "test_packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempt_section_sessions" ADD CONSTRAINT "attempt_section_sessions_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempt_section_sessions" ADD CONSTRAINT "attempt_section_sessions_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempt_answers" ADD CONSTRAINT "attempt_answers_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempt_answers" ADD CONSTRAINT "attempt_answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
