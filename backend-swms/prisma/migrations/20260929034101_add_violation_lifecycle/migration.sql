-- AlterTable
ALTER TABLE "violations" ADD COLUMN     "resolved_at" TIMESTAMP(3),
ADD COLUMN     "resolved_by_name" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'active';

