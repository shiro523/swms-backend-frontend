-- AlterTable
ALTER TABLE "notifications" DROP COLUMN "is_read",
ADD COLUMN     "target_household_id" TEXT;

-- CreateTable
CREATE TABLE "notification_reads" (
    "notification_id" TEXT NOT NULL,
    "user_id" INTEGER NOT NULL,
    "read_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_reads_pkey" PRIMARY KEY ("notification_id","user_id")
);

-- CreateIndex
CREATE INDEX "notification_reads_user_id_idx" ON "notification_reads"("user_id");

-- CreateIndex
CREATE INDEX "notifications_target_household_id_idx" ON "notifications"("target_household_id");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_target_household_id_fkey" FOREIGN KEY ("target_household_id") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_reads" ADD CONSTRAINT "notification_reads_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_reads" ADD CONSTRAINT "notification_reads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

