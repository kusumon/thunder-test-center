-- AlterTable
ALTER TABLE "passages" ADD CONSTRAINT "passages_section_id_position_key" UNIQUE ("section_id", "position");
