-- AlterTable
ALTER TABLE "households" ADD COLUMN     "removal_reason" TEXT,
ADD COLUMN     "removed_at" TIMESTAMP(3),
ADD COLUMN     "removed_by_name" TEXT;
