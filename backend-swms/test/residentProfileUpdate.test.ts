// Coverage for a resident editing their own personal information
// (email/contact number/address) via the existing PATCH /api/households/:id
// endpoint — reused as-is, no new route. Confirms the update actually
// lands, that a resident cannot reach another household through it, and
// that household/purok reassignment is not possible even via a tampered
// request body. Isolated test database only, same gates as the rest of
// this suite.
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { createTestHousehold, createTestPurok, TEST_PASSWORD } from "./helpers/fixtures";
import { cleanupTestRun } from "./helpers/cleanup";
import { newTestRunId } from "./helpers/ids";
import { loginAs } from "./helpers/auth";

describe("resident personal-information update", () => {
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

  it("a resident can update their own email, contact number, and address", async () => {
    const runId = nextRunId();
    const purok = await createTestPurok(runId);
    const household = await createTestHousehold(purok);
    const residentAgent = await loginAs(household.residentUsername, TEST_PASSWORD);

    const newEmail = `updated-${runId}@example-test.invalid`;
    const res = await residentAgent.patch(`/api/households/${household.householdId}`).send({
      email: newEmail,
      contactNumber: "0911-222-3333",
      address: "456 Updated Street",
    });

    expect(res.status).toBe(200);
    expect(res.body.contactNumber).toBe("0911-222-3333");
    expect(res.body.address).toBe("456 Updated Street");

    const residentUser = await prisma.user.findFirst({ where: { username: household.residentUsername } });
    expect(residentUser?.email).toBe(newEmail);

    // Login still works after the email change — username is the login
    // identifier (auth.service.ts's login()), never email, so changing
    // email cannot break authentication.
    const reloginAgent = await loginAs(household.residentUsername, TEST_PASSWORD);
    const me = await reloginAgent.get("/api/auth/me");
    expect(me.status).toBe(200);
  });

  it("a resident cannot update another household's information through this endpoint", async () => {
    const purokA = await createTestPurok(nextRunId());
    const householdA = await createTestHousehold(purokA);

    const purokB = await createTestPurok(nextRunId());
    const householdB = await createTestHousehold(purokB);
    const residentB = await loginAs(householdB.residentUsername, TEST_PASSWORD);

    const attempt = await residentB
      .patch(`/api/households/${householdA.householdId}`)
      .send({ address: "Hijacked Address" });
    expect(attempt.status).toBe(404);

    const untouched = await prisma.household.findUniqueOrThrow({ where: { id: householdA.householdId } });
    expect(untouched.address).toBe("123 Test Street");
  });

  it("household/purok reassignment is not possible even via a tampered request body", async () => {
    const purokA = await createTestPurok(nextRunId());
    const householdA = await createTestHousehold(purokA);
    const purokB = await createTestPurok(nextRunId());
    const residentA = await loginAs(householdA.residentUsername, TEST_PASSWORD);

    const res = await residentA.patch(`/api/households/${householdA.householdId}`).send({
      contactNumber: "0900-000-0001",
      householdId: "some-other-household-id",
      purokId: purokB.purokId,
      id: "hh-hijacked",
    });
    expect(res.status).toBe(200);
    // The unrecognized fields are stripped by updateHouseholdSchema before
    // the service ever sees them (validate.middleware.ts replaces req.body
    // with the parsed, whitelisted result) — nothing about the household's
    // own id or purok assignment can move through this endpoint.
    expect(res.body.id).toBe(householdA.householdId);
    expect(res.body.purokId).toBe(purokA.purokId);

    const row = await prisma.household.findUniqueOrThrow({ where: { id: householdA.householdId } });
    expect(row.purokId).toBe(purokA.purokId);
  });
});
