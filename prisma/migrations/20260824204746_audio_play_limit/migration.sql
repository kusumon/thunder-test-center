-- AlterTable
ALTER TABLE "attempt_section_sessions" ADD COLUMN     "audio_play_count" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "sections" ADD COLUMN     "audio_max_plays" INTEGER NOT NULL DEFAULT 2;
