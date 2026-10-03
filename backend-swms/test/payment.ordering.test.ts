// Regression coverage for payment list ordering. paymentRepository.findMany
// used to order only by household.code, which is constant for any single
// household's own payments — two payments for the same household then came
// back in whatever order Postgres happened to return them (observed as
// insertion order, never guaranteed), so the Resident dashboard's
// `payments[payments.length - 1]` ("latest payment") could silently show a
// payment that wasn't actually the most recent one.
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { createTestHousehold, createTestPurok, TEST_PASSWORD } from "./helpers/fixtures";
import { cleanupTestRun } from "./helpers/cleanup";
import { newTestRunId } from "./helpers/ids";
import { loginAs } from "./helpers/auth";

describe("payment list ordering", () => {
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

  it("returns payments for the same household most-recently-paid first, regardless of insertion order", async () => {
    const purok = await createTestPurok(nextRunId());
    const household = await createTestHousehold(purok);
    const leaderAgent = await loginAs(purok.leaderUsername, TEST_PASSWORD);

    // Inserted deliberately out of chronological order.
    await leaderAgent.post("/api/payments").send({ householdId: household.householdId, period: "January 2026", amount: 10, datePaid: "2026-01-15" });
    await leaderAgent.post("/api/payments").send({ householdId: household.householdId, period: "March 2026", amount: 30, datePaid: "2026-03-15" });
    await leaderAgent.post("/api/payments").send({ householdId: household.householdId, period: "February 2026", amount: 20, datePaid: "2026-02-15" });

    const residentAgent = await loginAs(household.residentUsername, TEST_PASSWORD);
    const res = await residentAgent.get("/api/payments");

    expect(res.status).toBe(200);
    const periods = res.body.map((p: { period: string }) => p.period);
    expect(periods).toEqual(["March 2026", "February 2026", "January 2026"]);
  });
});
