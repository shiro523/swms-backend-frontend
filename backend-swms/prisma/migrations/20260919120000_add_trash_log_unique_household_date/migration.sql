-- CreateIndex
CREATE UNIQUE INDEX "trash_logs_household_id_log_date_key" ON "trash_logs"("household_id", "log_date");
