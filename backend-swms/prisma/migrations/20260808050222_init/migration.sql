-- CreateTable
CREATE TABLE "puroks" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "leader_name" TEXT NOT NULL,
    "compliance_rate" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "puroks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "households" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "representative" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "purok_id" TEXT NOT NULL,
    "contact_number" TEXT NOT NULL,
    "registered_at" DATE NOT NULL,
    "status" TEXT NOT NULL,
    "payment_status" TEXT NOT NULL,
    "compliance_rate" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "households_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "family_members" (
    "id" TEXT NOT NULL,
    "household_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "relation" TEXT NOT NULL,
    "age" INTEGER NOT NULL,

    CONSTRAINT "family_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trash_logs" (
    "id" TEXT NOT NULL,
    "household_id" TEXT NOT NULL,
    "log_date" DATE NOT NULL,
    "log_time" TEXT NOT NULL,
    "collector" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "disposed_by" TEXT NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trash_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "violations" (
    "id" TEXT NOT NULL,
    "household_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "v_date" DATE NOT NULL,
    "is_repeat" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "violations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "household_id" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "status" TEXT NOT NULL,
    "date_paid" DATE,
    "or_number" TEXT,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "n_date" DATE NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monthly_collection_stats" (
    "ord" INTEGER NOT NULL,
    "month" TEXT NOT NULL,
    "compliant" INTEGER NOT NULL,
    "violations" INTEGER NOT NULL,
    "missed" INTEGER NOT NULL,

    CONSTRAINT "monthly_collection_stats_pkey" PRIMARY KEY ("ord")
);

-- CreateTable
CREATE TABLE "payment_collection_stats" (
    "ord" INTEGER NOT NULL,
    "month" TEXT NOT NULL,
    "collected" INTEGER NOT NULL,
    "target" INTEGER NOT NULL,

    CONSTRAINT "payment_collection_stats_pkey" PRIMARY KEY ("ord")
);

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "household_id" TEXT,
    "purok_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "households_code_key" ON "households"("code");

-- CreateIndex
CREATE INDEX "households_purok_id_idx" ON "households"("purok_id");

-- CreateIndex
CREATE INDEX "family_members_household_id_idx" ON "family_members"("household_id");

-- CreateIndex
CREATE INDEX "trash_logs_household_id_idx" ON "trash_logs"("household_id");

-- CreateIndex
CREATE INDEX "violations_household_id_idx" ON "violations"("household_id");

-- CreateIndex
CREATE INDEX "payments_household_id_idx" ON "payments"("household_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- AddForeignKey
ALTER TABLE "households" ADD CONSTRAINT "households_purok_id_fkey" FOREIGN KEY ("purok_id") REFERENCES "puroks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_members" ADD CONSTRAINT "family_members_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trash_logs" ADD CONSTRAINT "trash_logs_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "violations" ADD CONSTRAINT "violations_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_purok_id_fkey" FOREIGN KEY ("purok_id") REFERENCES "puroks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
