// Regression coverage for the admin-only PATCH /api/payments/:id/period
// correction endpoint — the narrow fix for a payment recorded with a
// malformed period (e.g. the real "October" instead of "October 2026")
// that can never be created again (payment.period.test.ts covers that),
// but that may already exist from before the create-time validation fix.
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { createTestHousehold, createTestPurok, createTestAdmin, TEST_PASSWORD } from "./helpers/fixtures";
import { cleanupTestRun } from "./helpers/cleanup";
import { newTestRunId } from "./helpers/ids";
import { loginAs } from "./helpers/auth";

describe("payment period correction (admin-only)", () => {
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

  // Seeded directly via Prisma, not through the API, because the create
  // endpoint itself now rejects this exact malformed value — this
  // reproduces a payment that already existed before that fix shipped.
  async function seedMalformedPayment(householdId: string) {
    return prisma.payment.create({
      data: {
        id: `pay-${newTestRunId()}`,
        householdId,
        period: "October",
        amount: 10,
        status: "paid",
        datePaid: new Date("2026-10-02"),
      },
    });
  }

  it("admin can correct a malformed period to the canonical form", async () => {
    const purok = await createTestPurok(nextRunId());
    const household = await createTestHousehold(purok);
    const payment = await seedMalformedPayment(household.householdId);
    const admin = await createTestAdmin(nextRunId());
    const adminAgent = await loginAs(admin.username, TEST_PASSWORD);

    const res = await adminAgent.patch(`/api/payments/${payment.id}/period`).send({ period: "October 2026" });
    expect(res.status).toBe(200);
    expect(res.body.period).toBe("October 2026");
    expect(res.body.id).toBe(payment.id);
  });

  it("purok leader cannot correct a payment's period", async () => {
    const purok = await createTestPurok(nextRunId());
    const household = await createTestHousehold(purok);
    const payment = await seedMalformedPayment(household.householdId);
    const leaderAgent = await loginAs(purok.leaderUsername, TEST_PASSWORD);

    const res = await leaderAgent.patch(`/api/payments/${payment.id}/period`).send({ period: "October 2026" });
    expect(res.status).toBe(403);
    const unchanged = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(unchanged.period).toBe("October");
  });

  it("resident cannot correct a payment's period", async () => {
    const purok = await createTestPurok(nextRunId());
    const household = await createTestHousehold(purok);
    const payment = await seedMalformedPayment(household.householdId);
    const residentAgent = await loginAs(household.residentUsername, TEST_PASSWORD);

    const res = await residentAgent.patch(`/api/payments/${payment.id}/period`).send({ period: "October 2026" });
    expect(res.status).toBe(403);
  });

  it("other payment fields cannot be changed through the correction endpoint, even if included in the request", async () => {
    const purok = await createTestPurok(nextRunId());
    const household = await createTestHousehold(purok);
    const otherHousehold = await createTestHousehold(purok, 2);
    const payment = await seedMalformedPayment(household.householdId);
    const admin = await createTestAdmin(nextRunId());
    const adminAgent = await loginAs(admin.username, TEST_PASSWORD);

    const res = await adminAgent.patch(`/api/payments/${payment.id}/period`).send({
      period: "October 2026",
      amount: 99999,
      householdId: otherHousehold.householdId,
      datePaid: "2020-01-01",
      id: "pay-hijacked",
    });
    expect(res.status).toBe(200);
    expect(res.body.amount).toBe(10);
    expect(res.body.householdId).toBe(household.householdId);
    expect(res.body.datePaid).toBe("2026-10-02");
    expect(res.body.id).toBe(payment.id);
  });

  it("invalid periods are rejected", async () => {
    const purok = await createTestPurok(nextRunId());
    const household = await createTestHousehold(purok);
    const payment = await seedMalformedPayment(household.householdId);
    const admin = await createTestAdmin(nextRunId());
    const adminAgent = await loginAs(admin.username, TEST_PASSWORD);

    const stillMalformed = await adminAgent.patch(`/api/payments/${payment.id}/period`).send({ period: "October" });
    expect(stillMalformed.status).toBe(400);

    const abbreviated = await adminAgent.patch(`/api/payments/${payment.id}/period`).send({ period: "Oct 2026" });
    expect(abbreviated.status).toBe(400);
  });

  it("the corrected payment is recognized as paid for the current period, with no duplicate created", async () => {
    const purok = await createTestPurok(nextRunId());
    const household = await createTestHousehold(purok);
    const payment = await seedMalformedPayment(household.householdId);
    const admin = await createTestAdmin(nextRunId());
    const adminAgent = await loginAs(admin.username, TEST_PASSWORD);

    const periodRes = await adminAgent.get("/api/payments/current-period");
    const currentPeriod: string = periodRes.body.period;

    const res = await adminAgent.patch(`/api/payments/${payment.id}/period`).send({ period: currentPeriod });
    expect(res.status).toBe(200);

    const rows = await prisma.payment.findMany({ where: { householdId: household.householdId } });
    expect(rows.length).toBe(1);
    expect(rows[0].period).toBe(currentPeriod);

    const afterCorrection = await adminAgent.get(`/api/payments?householdId=${household.householdId}`);
    expect(afterCorrection.body.some((p: { period: string }) => p.period === currentPeriod)).toBe(true);
  });
});
