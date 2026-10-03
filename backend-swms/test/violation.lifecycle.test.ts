// Tier 1 coverage for the violation lifecycle (ACTIVE -> COMPLETED),
// cross-purok scope, the repeat-offense rule, and the notification side
// effects of the real trash-log-violation flow.
//
// A violation is only ever produced as a side effect of POST /api/trash-logs
// with status="violation" — there is no direct "create violation" endpoint
// — so every violation fixture in this file goes through that real flow,
// never a direct Prisma insert.
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  createTestAdmin,
  createTestHousehold,
  createTestPurok,
  TEST_PASSWORD,
  type TestHouseholdFixture,
  type TestPurokFixture,
} from "./helpers/fixtures";
import { cleanupTestRun } from "./helpers/cleanup";
import { newTestRunId } from "./helpers/ids";
import { loginAs } from "./helpers/auth";

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

describe("violation lifecycle", () => {
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

  // Creates one household and records one violation for it via the real
  // trash-log flow (POST /api/trash-logs, status: "violation"), authenticated
  // as that household's own purok leader. Returns the created Violation row.
  async function createActiveViolation(purok: TestPurokFixture, household: TestHouseholdFixture) {
    const leaderAgent = await loginAs(purok.leaderUsername, TEST_PASSWORD);
    const res = await leaderAgent
      .post("/api/trash-logs")
      .send({ householdId: household.householdId, status: "violation", disposedBy: "owner" });
    expect(res.status).toBe(201);
    return prisma.violation.findFirstOrThrow({ where: { householdId: household.householdId } });
  }

  describe("completion", () => {
    it("admin can complete an active violation: status, resolvedAt, and resolvedByName are set", async () => {
      const purok = await createTestPurok(nextRunId());
      const household = await createTestHousehold(purok);
      const violation = await createActiveViolation(purok, household);

      const admin = await createTestAdmin(nextRunId());
      const adminAgent = await loginAs(admin.username, TEST_PASSWORD);
      const res = await adminAgent.patch(`/api/violations/${violation.id}/complete`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("completed");
      expect(res.body.resolvedAt).not.toBeNull();
      expect(res.body.resolvedByName).toBe("Test Admin");
    });

    it("the in-scope purok leader can complete an active violation", async () => {
      const purok = await createTestPurok(nextRunId());
      const household = await createTestHousehold(purok);
      const violation = await createActiveViolation(purok, household);

      const leaderAgent = await loginAs(purok.leaderUsername, TEST_PASSWORD);
      const res = await leaderAgent.patch(`/api/violations/${violation.id}/complete`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("completed");
      expect(res.body.resolvedByName).toBe("Test Leader");
    });

    it("a resident cannot complete a violation", async () => {
      const purok = await createTestPurok(nextRunId());
      const household = await createTestHousehold(purok);
      const violation = await createActiveViolation(purok, household);

      const residentAgent = await loginAs(household.residentUsername, TEST_PASSWORD);
      const res = await residentAgent.patch(`/api/violations/${violation.id}/complete`);

      expect(res.status).toBe(403);
    });

    it("completing an already-completed violation is rejected and does not change resolvedAt/resolvedByName", async () => {
      const purok = await createTestPurok(nextRunId());
      const household = await createTestHousehold(purok);
      const violation = await createActiveViolation(purok, household);

      const adminAgent = await loginAs((await createTestAdmin(nextRunId())).username, TEST_PASSWORD);
      const first = await adminAgent.patch(`/api/violations/${violation.id}/complete`);
      expect(first.status).toBe(200);

      const second = await adminAgent.patch(`/api/violations/${violation.id}/complete`);
      expect(second.status).toBe(400);

      const row = await prisma.violation.findUniqueOrThrow({ where: { id: violation.id } });
      expect(row.resolvedAt?.toISOString()).toBe(new Date(first.body.resolvedAt).toISOString());
      expect(row.resolvedByName).toBe(first.body.resolvedByName);
    });
  });

  describe("scope", () => {
    it("a purok leader cannot complete or otherwise access another purok's violation", async () => {
      const purokA = await createTestPurok(nextRunId());
      const purokB = await createTestPurok(nextRunId());
      const householdB = await createTestHousehold(purokB);
      const violationB = await createActiveViolation(purokB, householdB);

      const leaderA = await loginAs(purokA.leaderUsername, TEST_PASSWORD);
      const completeAttempt = await leaderA.patch(`/api/violations/${violationB.id}/complete`);
      expect(completeAttempt.status).toBe(404);

      const listAttempt = await leaderA.get(`/api/violations?householdId=${householdB.householdId}`);
      expect(listAttempt.status).toBe(200);
      expect(listAttempt.body).toEqual([]);

      // Admin is authorized to complete it, unlike leader A.
      const adminAgent = await loginAs((await createTestAdmin(nextRunId())).username, TEST_PASSWORD);
      const adminComplete = await adminAgent.patch(`/api/violations/${violationB.id}/complete`);
      expect(adminComplete.status).toBe(200);
    });
  });

  describe("repeat-offense rule", () => {
    it("a second violation for the same household is flagged isRepeat, and a completed historical violation still counts", async () => {
      const purok = await createTestPurok(nextRunId());
      const household = await createTestHousehold(purok);
      const leaderAgent = await loginAs(purok.leaderUsername, TEST_PASSWORD);

      // Violation 1 (today) — the household's first ever violation.
      const violation1 = await createActiveViolation(purok, household);
      expect(violation1.isRepeat).toBe(false);
      const today = violation1.vDate;

      // TrashLog creation is limited to one per household per calendar date
      // — the real API has no client-supplied date, so there is no way to
      // create a second same-day violation for this household through it.
      // This directly shifts the date on the just-created row (the exact
      // technique already used, and approved, for this same scenario during
      // earlier manual testing of the repeat-offense rule) to free "today"
      // back up, rather than fabricating a second violation directly.
      const yesterday = addDays(today, -1);
      await prisma.trashLog.updateMany({
        where: { householdId: household.householdId, logDate: today },
        data: { logDate: yesterday },
      });
      await prisma.violation.updateMany({
        where: { householdId: household.householdId, vDate: today },
        data: { vDate: yesterday },
      });

      // Violation 2 (today, now free again) — a genuine second offense.
      const res2 = await leaderAgent
        .post("/api/trash-logs")
        .send({ householdId: household.householdId, status: "violation", disposedBy: "owner" });
      expect(res2.status).toBe(201);
      const violation2 = await prisma.violation.findFirstOrThrow({
        where: { householdId: household.householdId, vDate: today },
      });
      expect(violation2.isRepeat).toBe(true);

      // Complete violation 1 (the historical one) — proves completing it
      // does not erase it from repeat-offense history.
      const adminAgent = await loginAs((await createTestAdmin(nextRunId())).username, TEST_PASSWORD);
      const completeRes = await adminAgent.patch(`/api/violations/${violation1.id}/complete`);
      expect(completeRes.status).toBe(200);

      // Free "today" up again by moving violation 2 back two days.
      const twoDaysAgo = addDays(today, -2);
      await prisma.trashLog.updateMany({
        where: { householdId: household.householdId, logDate: today },
        data: { logDate: twoDaysAgo },
      });
      await prisma.violation.updateMany({
        where: { householdId: household.householdId, vDate: today },
        data: { vDate: twoDaysAgo },
      });

      // Violation 3 (today) — the household now has one completed and one
      // active prior violation. isRepeat must still be true: countByHousehold
      // is deliberately unconditional on status.
      const res3 = await leaderAgent
        .post("/api/trash-logs")
        .send({ householdId: household.householdId, status: "violation", disposedBy: "owner" });
      expect(res3.status).toBe(201);
      const violation3 = await prisma.violation.findFirstOrThrow({
        where: { householdId: household.householdId, vDate: today },
      });
      expect(violation3.isRepeat).toBe(true);
    });
  });

  describe("notification side effects", () => {
    it("a violation created via the real trash-log flow produces exactly one household notification and one purok-leader notification", async () => {
      const purok = await createTestPurok(nextRunId());
      const household = await createTestHousehold(purok);

      const before = await prisma.notification.count({
        where: { OR: [{ targetHouseholdId: household.householdId }, { targetPurokId: purok.purokId }] },
      });
      expect(before).toBe(0);

      await createActiveViolation(purok, household);

      const notifications = await prisma.notification.findMany({
        where: { OR: [{ targetHouseholdId: household.householdId }, { targetPurokId: purok.purokId }] },
      });
      expect(notifications.length).toBe(2);

      const residentNotification = notifications.find((n) => n.targetHouseholdId === household.householdId);
      expect(residentNotification).toBeDefined();
      expect(residentNotification?.leaderOnly).toBe(false);
      expect(residentNotification?.targetPurokId).toBeNull();

      const leaderNotification = notifications.find((n) => n.targetPurokId === purok.purokId);
      expect(leaderNotification).toBeDefined();
      expect(leaderNotification?.leaderOnly).toBe(true);
      expect(leaderNotification?.targetHouseholdId).toBeNull();
    });
  });
});
