// Weekly collection rules: one trash log per household per collection week,
// automatic "missed" logs for weeks with no collection, and a late pickup
// replacing that week's "missed" log.
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { collectionWeekStart, parseCollectionWeekday } from "@/lib/collectionWeek";
import { trashLogService } from "@/services/trashLog.service";
import { createTestHousehold, createTestPurok, TEST_PASSWORD } from "./helpers/fixtures";
import { cleanupTestRun } from "./helpers/cleanup";
import { newTestRunId } from "./helpers/ids";
import { loginAs } from "./helpers/auth";

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const SUNDAY = 0;

describe("collection week helpers", () => {
  it("reads the first weekday named in the settings text, defaulting to Sunday", () => {
    expect(parseCollectionWeekday("Sunday")).toBe(0);
    expect(parseCollectionWeekday("every Wed, 6 AM")).toBe(3);
    expect(parseCollectionWeekday("Saturday and Sunday")).toBe(6);
    expect(parseCollectionWeekday("")).toBe(0);
    expect(parseCollectionWeekday("weekly")).toBe(0);
  });

  it("starts the week on the most recent collection day", () => {
    // 2026-10-04 is a Sunday.
    expect(collectionWeekStart(day("2026-10-04"), SUNDAY)).toEqual(day("2026-10-04"));
    expect(collectionWeekStart(day("2026-10-05"), SUNDAY)).toEqual(day("2026-10-04"));
    expect(collectionWeekStart(day("2026-10-10"), SUNDAY)).toEqual(day("2026-10-04"));
    expect(collectionWeekStart(day("2026-10-11"), SUNDAY)).toEqual(day("2026-10-11"));
    expect(collectionWeekStart(day("2026-10-07"), 3)).toEqual(day("2026-10-07")); // Wednesday
  });
});

describe("weekly collection", () => {
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

  it("marks every passed collection week with no log as missed, once", async () => {
    const purok = await createTestPurok(nextRunId());
    const missedAll = await createTestHousehold(purok, 1);
    const collectedOnce = await createTestHousehold(purok, 2);
    const ids = [missedAll.householdId, collectedOnce.householdId];
    await prisma.household.updateMany({ where: { id: { in: ids } }, data: { registeredAt: day("2026-10-01") } });
    // A late (Monday) pickup inside the 2026-10-11 week.
    await prisma.trashLog.create({
      data: {
        id: `tl-test-${collectedOnce.householdId}`,
        householdId: collectedOnce.householdId,
        logDate: day("2026-10-12"),
        logTime: "07:00 AM",
        collector: "Test Leader",
        status: "compliant",
        disposedBy: "owner",
      },
    });

    // Tuesday 2026-10-13: the 10-04 and 10-11 collection days have passed.
    const options = { today: day("2026-10-13"), collectionWeekday: SUNDAY, householdWhere: { id: { in: ids } } };
    expect(await trashLogService.markMissedCollections(options)).toBe(3);
    expect(await trashLogService.markMissedCollections(options)).toBe(0);

    const missed = await prisma.trashLog.findMany({
      where: { householdId: { in: ids }, status: "missed" },
      orderBy: [{ householdId: "asc" }, { logDate: "asc" }],
    });
    expect(missed.map((l) => [l.householdId, l.logDate.toISOString().slice(0, 10)])).toEqual([
      [missedAll.householdId, "2026-10-04"],
      [missedAll.householdId, "2026-10-11"],
      [collectedOnce.householdId, "2026-10-04"],
    ]);

    const households = await prisma.household.findMany({ where: { id: { in: ids } }, orderBy: { id: "asc" } });
    expect(households.map((h) => h.complianceRate)).toEqual([0, 50]);
  });

  it("does not mark the collection day itself, or weeks before the household registered", async () => {
    const purok = await createTestPurok(nextRunId());
    const household = await createTestHousehold(purok);
    await prisma.household.update({ where: { id: household.householdId }, data: { registeredAt: day("2026-10-06") } });

    // Sunday 2026-10-11 is still in progress; the 10-04 week predates registration.
    const created = await trashLogService.markMissedCollections({
      today: day("2026-10-11"),
      collectionWeekday: SUNDAY,
      householdWhere: { id: household.householdId },
    });
    expect(created).toBe(0);
  });

  it("a removed household keeps its history but gets no new logs (scans refused, never marked missed)", async () => {
    const purok = await createTestPurok(nextRunId());
    const household = await createTestHousehold(purok);
    await prisma.household.update({ where: { id: household.householdId }, data: { registeredAt: day("2026-10-01") } });
    const leaderAgent = await loginAs(purok.leaderUsername, TEST_PASSWORD);

    // One real scan while active.
    const scan = await leaderAgent
      .post("/api/trash-logs")
      .send({ householdId: household.householdId, status: "compliant", disposedBy: "owner" });
    expect(scan.status).toBe(201);

    const removed = await leaderAgent.post(`/api/households/${household.householdId}/remove`).send({ reason: "Moved away" });
    expect(removed.status).toBe(200);

    // History stays visible (this is what Waste monitoring is built from).
    const logs = await leaderAgent.get(`/api/trash-logs?householdId=${household.householdId}`);
    expect(logs.body.map((l: { status: string }) => l.status)).toEqual(["compliant"]);

    // New scans are refused.
    const again = await leaderAgent
      .post("/api/trash-logs")
      .send({ householdId: household.householdId, status: "violation", disposedBy: "owner" });
    expect(again.status).toBe(400);
    expect(again.body.error).toMatch(/removed/i);

    // The missed-collection job skips it, even for weeks it was never scanned.
    const created = await trashLogService.markMissedCollections({
      today: day("2026-10-20"),
      collectionWeekday: SUNDAY,
      householdWhere: { id: household.householdId },
    });
    expect(created).toBe(0);
    expect(await prisma.trashLog.count({ where: { householdId: household.householdId } })).toBe(1);
  });

  it("a late pickup replaces this week's missed log, and a second log that week is rejected", async () => {
    const purok = await createTestPurok(nextRunId());
    const household = await createTestHousehold(purok);
    const leaderAgent = await loginAs(purok.leaderUsername, TEST_PASSWORD);
    const { weekStart } = await trashLogService.currentCollectionWeek();

    await prisma.trashLog.create({
      data: {
        id: `tl-test-missed-${household.householdId}`,
        householdId: household.householdId,
        logDate: day(weekStart),
        logTime: "—",
        collector: "System",
        status: "missed",
        disposedBy: "representative",
      },
    });

    const late = await leaderAgent
      .post("/api/trash-logs")
      .send({ householdId: household.householdId, status: "compliant", disposedBy: "owner" });
    expect(late.status).toBe(201);

    const again = await leaderAgent
      .post("/api/trash-logs")
      .send({ householdId: household.householdId, status: "compliant", disposedBy: "owner" });
    expect(again.status).toBe(409);
    expect(again.body.error).toMatch(/this collection week/i);

    const logs = await prisma.trashLog.findMany({ where: { householdId: household.householdId } });
    expect(logs.map((l) => l.status)).toEqual(["compliant"]);
  });
});
