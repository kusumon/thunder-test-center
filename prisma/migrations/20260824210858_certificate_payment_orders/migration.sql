-- CreateEnum
CREATE TYPE "CertificateOrderStatus" AS ENUM ('MENUNGGU_PEMBAYARAN', 'MENUNGGU_KONFIRMASI', 'DISETUJUI', 'DITOLAK');

-- CreateTable
CREATE TABLE "certificate_orders" (
    "id" UUID NOT NULL,
    "attempt_id" UUID NOT NULL,
    "claim_code" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "whatsapp_number" TEXT,
    "status" "CertificateOrderStatus" NOT NULL DEFAULT 'MENUNGGU_PEMBAYARAN',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paid_claimed_at" TIMESTAMP(3),
    "reviewed_at" TIMESTAMP(3),
    "reviewed_by_id" UUID,
    "review_note" TEXT,

    CONSTRAINT "certificate_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_settings" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "certificate_orders_attempt_id_key" ON "certificate_orders"("attempt_id");

-- CreateIndex
CREATE UNIQUE INDEX "certificate_orders_claim_code_key" ON "certificate_orders"("claim_code");

-- CreateIndex
CREATE INDEX "certificate_orders_status_created_at_idx" ON "certificate_orders"("status", "created_at");

-- AddForeignKey
ALTER TABLE "certificate_orders" ADD CONSTRAINT "certificate_orders_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificate_orders" ADD CONSTRAINT "certificate_orders_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
