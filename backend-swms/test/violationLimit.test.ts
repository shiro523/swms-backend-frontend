// Violation limit: from the 5th violation on record, the purok leader and the
// admin are alerted and the household appears in the at-limit list; only the
// admin can send the resident a consequence notice.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { getDbToday } from "@/lib/dbTime";
import { CONSEQUENCE_NOTICE_TITLE, VIOLATION_LIMIT_ALERT_TITLE, VIOLATION_NOTICE_THRESHOLD } from "@/lib/violationPolicy";
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

const DAY_MS = 24 * 60 * 60 * 1000;

describe("violation limit and consequence notices", () => {
  const runIds: string[] = [];
  function nextRunId(): string {
    const id = newTestRunId();
    runIds.push(id);
    return id;
  }

  let purok: TestPurokFixture;
  let household: TestHouseholdFixture;
  let below: TestHouseholdFixture;
  let adminUsername: string;

  // Records one violation through the real scan API, then moves it back a
  // whole number of weeks so the current collection week is free again.
  async function recordViolation(target: TestHouseholdFixture, weeksAgo: number) {
    const leader = await loginAs(purok.leaderUsername, TEST_PASSWORD);
    const res = await leader
      .post("/api/trash-logs")
      .send({ householdId: target.householdId, status: "violation", disposedBy: "owner" });
    expect(res.status).toBe(201);
    const today = await getDbToday();
    const past = new Date(today.getTime() - weeksAgo * 7 * DAY_MS);
    await prisma.trashLog.updateMany({ where: { householdId: target.householdId, logDate: today }, data: { logDate: past } });
    await prisma.violation.updateMany({ where: { householdId: target.householdId, vDate: today }, data: { vDate: past } });
  }

  const limitAlerts = () =>
    prisma.notification.findMany({ where: { title: VIOLATION_LIMIT_ALERT_TITLE, targetPurokId: purok.purokId } });

  beforeAll(async () => {
    purok = await createTestPurok(nextRunId());
    household = await createTestHousehold(purok, 1);
    below = await createTestHousehold(purok, 2);
    adminUsername = (await createTestAdmin(nextRunId())).username;
  });

  afterAll(async () => {
    for (const id of runIds) {
      await cleanupTestRun(id);
    }
    await prisma.$disconnect();
  });

  it("does not flag a household below the limit", async () => {
    for (let i = 1; i < VIOLATION_NOTICE_THRESHOLD; i++) await recordViolation(household, i);
    expect(await limitAlerts()).toHaveLength(0);

    const leader = await loginAs(purok.leaderUsername, TEST_PASSWORD);
    const atLimit = await leader.get("/api/violations/at-limit");
    expect(atLimit.status).toBe(200);
    expect(atLimit.body.threshold).toBe(VIOLATION_NOTICE_THRESHOLD);
    expect(atLimit.body.households).toEqual([]);
  });

  it("flags the household to the leader and admin (not the resident) at the 5th violation", async () => {
    await recordViolation(household, VIOLATION_NOTICE_THRESHOLD);
    const alerts = await limitAlerts();
    expect(alerts).toHaveLength(1);
    expect(alerts[0].leaderOnly).toBe(true);

    const leader = await loginAs(purok.leaderUsername, TEST_PASSWORD);
    const atLimit = (await leader.get("/api/violations/at-limit")).body.households;
    expect(atLimit).toHaveLength(1);
    expect(atLimit[0]).toMatchObject({
      householdId: household.householdId,
      totalViolations: VIOLATION_NOTICE_THRESHOLD,
      activeViolations: VIOLATION_NOTICE_THRESHOLD,
      noticesSent: 0,
      lastNoticeDate: null,
    });

    const ids = async (agent: Awaited<ReturnType<typeof loginAs>>) =>
      (await agent.get("/api/notifications")).body.map((n: { id: string }) => n.id);
    const admin = await loginAs(adminUsername, TEST_PASSWORD);
    const resident = await loginAs(household.residentUsername, TEST_PASSWORD);
    expect(await ids(leader)).toContain(alerts[0].id);
    expect(await ids(admin)).toContain(alerts[0].id);
    expect(await ids(resident)).not.toContain(alerts[0].id);
  });

  it("only the admin can send a consequence notice, and only to a household at the limit", async () => {
    const admin = await loginAs(adminUsername, TEST_PASSWORD);
    const leader = await loginAs(purok.leaderUsername, TEST_PASSWORD);
    const resident = await loginAs(household.residentUsername, TEST_PASSWORD);
    const message = "Your household has reached 5 violations. Please see the barangay office.";

    expect((await leader.post("/api/violations/consequence-notices").send({ householdId: household.householdId, message })).status).toBe(403);
    expect((await resident.post("/api/violations/consequence-notices").send({ householdId: household.householdId, message })).status).toBe(403);
    expect((await resident.get("/api/violations/at-limit")).status).toBe(403);

    const tooEarly = await admin.post("/api/violations/consequence-notices").send({ householdId: below.householdId, message });
    expect(tooEarly.status).toBe(400);

    const sent = await admin.post("/api/violations/consequence-notices").send({ householdId: household.householdId, message });
    expect(sent.status).toBe(201);

    const residentNotes = (await resident.get("/api/notifications")).body;
    const notice = residentNotes.find((n: { title: string }) => n.title === CONSEQUENCE_NOTICE_TITLE);
    expect(notice?.message).toBe(message);

    const atLimit = (await admin.get("/api/violations/at-limit")).body.households;
    const row = atLimit.find((h: { householdId: string }) => h.householdId === household.householdId);
    expect(row.noticesSent).toBe(1);
    expect(row.lastNoticeDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("completed violations still count toward the limit; the leader completes them", async () => {
    const leader = await loginAs(purok.leaderUsername, TEST_PASSWORD);
    const violations = (await leader.get(`/api/violations?householdId=${household.householdId}`)).body;
    const done = await leader.patch(`/api/violations/${violations[0].id}/complete`);
    expect(done.status).toBe(200);

    const row = (await leader.get("/api/violations/at-limit")).body.households.find(
      (h: { householdId: string }) => h.householdId === household.householdId,
    );
    expect(row.totalViolations).toBe(VIOLATION_NOTICE_THRESHOLD);
    expect(row.activeViolations).toBe(VIOLATION_NOTICE_THRESHOLD - 1);
  });
});
