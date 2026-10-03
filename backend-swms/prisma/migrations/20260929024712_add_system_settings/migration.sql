-- CreateTable
CREATE TABLE "system_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "barangay_name" TEXT NOT NULL DEFAULT '',
    "municipality" TEXT NOT NULL DEFAULT '',
    "contact_number" TEXT NOT NULL DEFAULT '',
    "monthly_collection_fee" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "collection_days" TEXT NOT NULL DEFAULT '',
    "collection_time" TEXT NOT NULL DEFAULT '',
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

