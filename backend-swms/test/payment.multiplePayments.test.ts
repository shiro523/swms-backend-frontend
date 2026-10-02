// Regression coverage for allowing multiple/partial payments toward the
// same household+period. The real business rule is weekly Sunday
// collections where a household may pay in installments — the Payment
// model used to have a (householdId, period) unique constraint that
// rejected a second payment for the same period with a 409, which directly
// contradicted that rule. This migration/fix dropped that constraint; these
// tests confirm multiple payments are now stored, remain in full history,
// and that the existing (existence-based) paid/unpaid calculation still
// works correctly with more than one matching row.
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { createTestHousehold, createTestPurok, createTestAdmin, TEST_PASSWORD } from "./helpers/fixtures";
import { cleanupTestRun } from "./helpers/cleanup";
import { newTestRunId } from "./helpers/ids";
import { loginAs } from "./helpers/auth";

describe("multiple/partial payments for the same period", () => {
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

  it("a second payment for the same household and period succeeds (no longer a 409)", async () => {
    const purok = await createTestPurok(nextRunId());
    const household = await createTestHousehold(purok);
    const leaderAgent = await loginAs(purok.leaderUsername, TEST_PASSWORD);
    const periodRes = await leaderAgent.get("/api/payments/current-period");
    const currentPeriod: string = periodRes.body.period;

    const first = await leaderAgent.post("/api/payments").send({ householdId: household.householdId, period: currentPeriod, amount: 5 });
    expect(first.status).toBe(201);

    const second = await leaderAgent.post("/api/payments").send({ householdId: household.householdId, period: currentPeriod, amount: 5 });
    expect(second.status).toBe(201);

    const rows = await prisma.payment.findMany({ where: { householdId: household.householdId } });
    expect(rows.length).toBe(2);
  });

  it("three partial payments for the same period all remain in history, and Admin/Purok Leader agree on paid status", async () => {
    const purok = await createTestPurok(nextRunId());
    const household = await createTestHousehold(purok);
    const leaderAgent = await loginAs(purok.leaderUsername, TEST_PASSWORD);
    const admin = await createTestAdmin(nextRunId());
    const adminAgent = await loginAs(admin.username, TEST_PASSWORD);
    const periodRes = await leaderAgent.get("/api/payments/current-period");
    const currentPeriod: string = periodRes.body.period;

    await leaderAgent.post("/api/payments").send({ householdId: household.householdId, period: currentPeriod, amount: 5 });
    await leaderAgent.post("/api/payments").send({ householdId: household.householdId, period: currentPeriod, amount: 5 });
    await leaderAgent.post("/api/payments").send({ householdId: household.householdId, period: currentPeriod, amount: 3 });

    const leaderView = await leaderAgent.get(`/api/payments?householdId=${household.householdId}`);
    const adminView = await adminAgent.get(`/api/payments?householdId=${household.householdId}`);
    expect(leaderView.body.length).toBe(3);
    expect(adminView.body.length).toBe(3);

    const leaderPaid = leaderView.body.some((p: { period: string }) => p.period === currentPeriod);
    const adminPaid = adminView.body.some((p: { period: string }) => p.period === currentPeriod);
    expect(leaderPaid).toBe(true);
    expect(adminPaid).toBe(true);
  });

  it("correcting a payment's period into one the household already has another payment for no longer conflicts", async () => {
    const purok = await createTestPurok(nextRunId());
    const household = await createTestHousehold(purok);
    const admin = await createTestAdmin(nextRunId());
    const adminAgent = await loginAs(admin.username, TEST_PASSWORD);

    await prisma.payment.create({
      data: { id: `pay-${nextRunId()}`, householdId: household.householdId, period: "September 2026", amount: 10, status: "paid" },
    });
    const malformed = await prisma.payment.create({
      data: { id: `pay-${nextRunId()}`, householdId: household.householdId, period: "October", amount: 5, status: "paid" },
    });

    const res = await adminAgent.patch(`/api/payments/${malformed.id}/period`).send({ period: "September 2026" });
    expect(res.status).toBe(200);
    expect(res.body.period).toBe("September 2026");

    const rows = await prisma.payment.findMany({ where: { householdId: household.householdId } });
    expect(rows.length).toBe(2);
    expect(rows.every((r) => r.period === "September 2026")).toBe(true);
  });
});
