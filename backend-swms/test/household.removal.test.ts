// Targeted coverage for the household soft-removal 30-day restore window
// (household.service.ts's restore()). Runs only against the isolated test
// database — see helpers/testGuard.ts and globalSetup.ts, both already
// gating this file exactly as they gate every other test in this suite.
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  createTestAdmin,
  createTestHousehold,
  createTestPurok,
  TEST_PASSWORD,
} from "./helpers/fixtures";
import { cleanupTestRun } from "./helpers/cleanup";
import { newTestRunId } from "./helpers/ids";
import { loginAs } from "./helpers/auth";

const DAY_MS = 24 * 60 * 60 * 1000;

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * DAY_MS);
}

describe("household removal — 30-day restore window", () => {
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

  it("within 30 days: admin restore succeeds", async () => {
    const purok = await createTestPurok(nextRunId());
    const household = await createTestHousehold(purok);
    const leaderAgent = await loginAs(purok.leaderUsername, TEST_PASSWORD);
    const removeRes = await leaderAgent
      .post(`/api/households/${household.householdId}/remove`)
      .send({ reason: "Test removal" });
    expect(removeRes.status).toBe(200);
    expect(removeRes.body.removedAt).not.toBeNull();

    const admin = await createTestAdmin(nextRunId());
    const adminAgent = await loginAs(admin.username, TEST_PASSWORD);
    const restoreRes = await adminAgent.post(`/api/households/${household.householdId}/restore`);

    expect(restoreRes.status).toBe(200);
    expect(restoreRes.body.removedAt).toBeNull();
    expect(restoreRes.body.removalReason).toBeNull();
    expect(restoreRes.body.removedByName).toBeNull();
  });

  it("more than 30 days: admin restore is rejected with 400, household stays removed, and its history is untouched", async () => {
    const purok = await createTestPurok(nextRunId());
    const household = await createTestHousehold(purok);
    const leaderAgent = await loginAs(purok.leaderUsername, TEST_PASSWORD);
    const removeRes = await leaderAgent
      .post(`/api/households/${household.householdId}/remove`)
      .send({ reason: "Test removal" });
    expect(removeRes.status).toBe(200);

    // Directly backdating removedAt on the isolated test DB — the same
    // approved technique violation.lifecycle.test.ts already uses to shift
    // TrashLog.logDate/Violation.vDate, applied here to removedAt since
    // there is no way to reach a 30-day-old removal through the real API
    // within a test run.
    await prisma.household.update({
      where: { id: household.householdId },
      data: { removedAt: daysAgo(31) },
    });

    const payment = await prisma.payment.create({
      data: {
        id: `test-pay-${household.householdId}`,
        householdId: household.householdId,
        period: "Test Period",
        amount: 50,
        status: "paid",
      },
    });

    const admin = await createTestAdmin(nextRunId());
    const adminAgent = await loginAs(admin.username, TEST_PASSWORD);
    const restoreRes = await adminAgent.post(`/api/households/${household.householdId}/restore`);

    expect(restoreRes.status).toBe(400);
    expect(restoreRes.body.error).toMatch(/removed more than 30 days ago.*can no longer be restored/i);

    const row = await prisma.household.findUniqueOrThrow({ where: { id: household.householdId } });
    expect(row.removedAt).not.toBeNull();

    const paymentRow = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(paymentRow.amount.toString()).toBe("50");
  });

  // The service's own check is `elapsed > RESTORE_WINDOW_MS` (strictly
  // greater than) — exactly 30 days must still be restorable, and only
  // beyond it is rejected. Exact-millisecond timing against the real
  // request's own network round trip isn't practical here, so this proves
  // the boundary with a few seconds of margin on each side instead.
  it("boundary: just under 30 days is restorable, just over is rejected", async () => {
    const purok = await createTestPurok(nextRunId());
    const householdUnder = await createTestHousehold(purok, 1);
    const householdOver = await createTestHousehold(purok, 2);

    await prisma.household.update({
      where: { id: householdUnder.householdId },
      data: {
        removedAt: new Date(Date.now() - (30 * DAY_MS - 5000)),
        removalReason: "Test removal",
        removedByName: "Test Leader",
      },
    });
    await prisma.household.update({
      where: { id: householdOver.householdId },
      data: {
        removedAt: new Date(Date.now() - (30 * DAY_MS + 5000)),
        removalReason: "Test removal",
        removedByName: "Test Leader",
      },
    });

    const admin = await createTestAdmin(nextRunId());
    const adminAgent = await loginAs(admin.username, TEST_PASSWORD);

    const underRes = await adminAgent.post(`/api/households/${householdUnder.householdId}/restore`);
    expect(underRes.status).toBe(200);

    const overRes = await adminAgent.post(`/api/households/${householdOver.householdId}/restore`);
    expect(overRes.status).toBe(400);
  });
});
