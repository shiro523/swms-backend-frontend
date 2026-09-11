-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "target_purok_id" TEXT;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_target_purok_id_fkey" FOREIGN KEY ("target_purok_id") REFERENCES "puroks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
