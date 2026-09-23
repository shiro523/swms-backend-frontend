-- CreateIndex
CREATE UNIQUE INDEX "payments_household_id_period_key" ON "payments"("household_id", "period");
