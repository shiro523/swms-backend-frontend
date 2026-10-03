-- DropIndex
DROP INDEX "payments_or_number_key";

-- AlterTable
ALTER TABLE "payments" DROP COLUMN "or_number";
