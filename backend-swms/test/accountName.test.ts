// Renaming a purok leader or a household representative must update the
// linked login account's name, and records created afterwards (collector,
// removed-by, resolved-by) must use the new name — even with a session token
// issued before the rename.
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

describe("account names follow renames", () => {
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

  it("a renamed purok leader's next scan records the new name, with a token issued before the rename", async () => {
    const purok = await createTestPurok(nextRunId());
    const household = await createTestHousehold(purok);
    const leaderAgent = await loginAs(purok.leaderUsername, TEST_PASSWORD);
    // Warm the session so the old name is what's cached, as in real use.
    expect((await leaderAgent.get("/api/auth/me")).status).toBe(200);

    const adminAgent = await loginAs((await createTestAdmin(nextRunId())).username, TEST_PASSWORD);
    const rename = await adminAgent.patch(`/api/puroks/${purok.purokId}`).send({ leaderName: "Renamed Leader" });
    expect(rename.status).toBe(200);

    const leader = await prisma.user.findUniqueOrThrow({ where: { username: purok.leaderUsername } });
    expect(leader.name).toBe("Renamed Leader");

    const scan = await leaderAgent
      .post("/api/trash-logs")
      .send({ householdId: household.householdId, status: "compliant", disposedBy: "owner" });
    expect(scan.status).toBe(201);
    expect(scan.body.collector).toBe("Renamed Leader");
  });

  it("renaming only the representative also renames the resident account", async () => {
    const purok = await createTestPurok(nextRunId());
    const household = await createTestHousehold(purok);
    const leaderAgent = await loginAs(purok.leaderUsername, TEST_PASSWORD);

    const res = await leaderAgent.patch(`/api/households/${household.householdId}`).send({ representative: "New Representative" });
    expect(res.status).toBe(200);

    const resident = await prisma.user.findUniqueOrThrow({ where: { username: household.residentUsername } });
    expect(resident.name).toBe("New Representative");
  });
});
