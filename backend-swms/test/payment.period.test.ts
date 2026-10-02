// Regression coverage for the payment-period format bug: a household could
// have a real payment recorded for "this period" that was still shown as
// unpaid on both Admin and Purok Leader pages, because the Period field
// accepted any free text and the stored value (e.g. "October", missing the
// year) never matched the canonical current-period string computed by
// payment.service.ts's currentPeriodLabel(), even case-insensitively.
// Reproduced against real data (a household's genuine payment stored as
// period "October" instead of "October 2026") before fixing.
//
// The fix enforces the canonical "Month YYYY" format at the one shared
// write path both roles use (POST /api/payments), so
// splitHouseholdsByCurrentPeriod's frontend comparison can never be
// defeated by a malformed stored value again.
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { createTestHousehold, createTestPurok, createTestAdmin, TEST_PASSWORD } from "./helpers/fixtures";
import { cleanupTestRun } from "./helpers/cleanup";
import { newTestRunId } from "./helpers/ids";
import { loginAs } from "./helpers/auth";

describe("payment period validation", () => {
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

  it("rejects a period missing the year — the exact real-world bug (e.g. 'October' instead of 'October 2026')", async () => {
    const purok = await createTestPurok(nextRunId());
    const household = await createTestHousehold(purok);
    const leaderAgent = await loginAs(purok.leaderUsername, TEST_PASSWORD);

    const res = await leaderAgent.post("/api/payments").send({ householdId: household.householdId, period: "October", amount: 10 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Month YYYY/);
  });

  it("rejects an abbreviated month name", async () => {
    const purok = await createTestPurok(nextRunId());
    const household = await createTestHousehold(purok);
    const leaderAgent = await loginAs(purok.leaderUsername, TEST_PASSWORD);

    const res = await leaderAgent.post("/api/payments").send({ householdId: household.householdId, period: "Oct 2026", amount: 10 });
    expect(res.status).toBe(400);
  });

  it("normalizes a case/whitespace-different but otherwise valid period to the canonical form", async () => {
    const purok = await createTestPurok(nextRunId());
    const household = await createTestHousehold(purok);
    const leaderAgent = await loginAs(purok.leaderUsername, TEST_PASSWORD);

    const res = await leaderAgent.post("/api/payments").send({ householdId: household.householdId, period: "  october 2026  ", amount: 10 });
    expect(res.status).toBe(201);
    expect(res.body.period).toBe("October 2026");
  });

  it("Admin and Purok Leader agree on paid/unpaid for the current period after a valid payment is recorded", async () => {
    const purok = await createTestPurok(nextRunId());
    const household = await createTestHousehold(purok);
    const leaderAgent = await loginAs(purok.leaderUsername, TEST_PASSWORD);
    const admin = await createTestAdmin(nextRunId());
    const adminAgent = await loginAs(admin.username, TEST_PASSWORD);

    const periodRes = await leaderAgent.get("/api/payments/current-period");
    const currentPeriod: string = periodRes.body.period;

    // Before paying: neither view has a payment matching the current period.
    const beforeAdmin = await adminAgent.get(`/api/payments?householdId=${household.householdId}`);
    expect(beforeAdmin.body.some((p: { period: string }) => p.period === currentPeriod)).toBe(false);

    const payRes = await leaderAgent.post("/api/payments").send({ householdId: household.householdId, period: currentPeriod, amount: 50 });
    expect(payRes.status).toBe(201);

    const afterLeader = await leaderAgent.get(`/api/payments?householdId=${household.householdId}`);
    const afterAdmin = await adminAgent.get(`/api/payments?householdId=${household.householdId}`);
    const leaderSeesPaid = afterLeader.body.some((p: { period: string }) => p.period === currentPeriod);
    const adminSeesPaid = afterAdmin.body.some((p: { period: string }) => p.period === currentPeriod);
    expect(leaderSeesPaid).toBe(true);
    expect(adminSeesPaid).toBe(true);
  });
});
