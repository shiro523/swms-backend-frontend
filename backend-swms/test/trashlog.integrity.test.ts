// Tier 1 data-integrity coverage for the "one TrashLog per household per
// calendar date" rule (trash_logs_household_id_log_date_key).
//
// Note on dates: POST /api/trash-logs does not accept a client-supplied
// date at all — trashLog.service.ts always uses the database's own
// CURRENT_DATE (getDbTodayAndTime(), src/lib/dbTime.ts). There is no way to
// submit a fixed date like "2026-01-15" through the real API, so these
// tests use "today" (whatever the isolated test database's current date
// actually is) for both requests — that's the only date the real endpoint
// will ever accept, and it still fully exercises the business rule: two
// submissions for the same household on the same day.
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { createTestHousehold, createTestPurok, TEST_PASSWORD } from "./helpers/fixtures";
import { cleanupTestRun } from "./helpers/cleanup";
import { newTestRunId } from "./helpers/ids";
import { loginAs } from "./helpers/auth";

describe("trash log integrity", () => {
  const runIds: string[] = [];
  function nextRunId(): string {
    const id = newTestRunId();
    runIds.push(id);
    return id;
  }

  afterAll(async () => {
    for (const id of runIds) {
      await cleanupTestRun(id);
    }
    await prisma.$disconnect();
  });

  it("sequential: first submission succeeds, second for the same household/date is rejected, exactly one row exists", async () => {
    const purok = await createTestPurok(nextRunId());
    const household = await createTestHousehold(purok);
    // Trash logs are created by admin/purok-leader only, never a resident —
    // log in as the household's own purok leader.
    const leaderAgent = await loginAs(purok.leaderUsername, TEST_PASSWORD);

    const first = await leaderAgent
      .post("/api/trash-logs")
      .send({ householdId: household.householdId, status: "compliant", disposedBy: "owner" });
    expect(first.status).toBe(201);

    const second = await leaderAgent
      .post("/api/trash-logs")
      .send({ householdId: household.householdId, status: "compliant", disposedBy: "owner" });
    expect(second.status).toBe(409);

    const rows = await prisma.trashLog.findMany({ where: { householdId: household.householdId } });
    expect(rows.length).toBe(1);
  });

  it("concurrent: two simultaneous requests for the same household/date resolve to exactly one success and one rejection, with exactly one database row", async () => {
    const purok = await createTestPurok(nextRunId());
    const household = await createTestHousehold(purok);
    const leaderAgent = await loginAs(purok.leaderUsername, TEST_PASSWORD);

    const body = { householdId: household.householdId, status: "compliant" as const, disposedBy: "owner" as const };
    const [resA, resB] = await Promise.all([
      leaderAgent.post("/api/trash-logs").send(body),
      leaderAgent.post("/api/trash-logs").send(body),
    ]);

    const statuses = [resA.status, resB.status].sort();
    expect(statuses).toEqual([201, 409]);
    expect(statuses).not.toContain(500);

    const rows = await prisma.trashLog.findMany({ where: { householdId: household.householdId } });
    expect(rows.length).toBe(1);
  });
});
