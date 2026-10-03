-- CreateIndex
CREATE INDEX "notifications_target_purok_id_idx" ON "notifications"("target_purok_id");

-- CreateIndex
CREATE INDEX "users_household_id_idx" ON "users"("household_id");

-- CreateIndex
CREATE INDEX "users_purok_id_idx" ON "users"("purok_id");
