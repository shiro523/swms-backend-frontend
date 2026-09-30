// Tier 1 coverage for the family-member edit/remove endpoints
// (PATCH/DELETE /api/households/:id/members/:memberId) — runs only against
// the isolated test database, same gates as every other test in this suite.
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { createTestHousehold, createTestPurok, TEST_PASSWORD } from "./helpers/fixtures";
import { cleanupTestRun } from "./helpers/cleanup";
import { newTestRunId } from "./helpers/ids";
import { loginAs } from "./helpers/auth";

describe("family member edit/remove", () => {
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

  it("a resident can edit their own family member, and it updates the existing record rather than creating a duplicate", async () => {
    const purok = await createTestPurok(nextRunId());
    const household = await createTestHousehold(purok);
    const residentAgent = await loginAs(household.residentUsername, TEST_PASSWORD);

    const addRes = await residentAgent
      .post(`/api/households/${household.householdId}/members`)
      .send({ name: "Juan Dela Cruz", relation: "Sibling", age: 30 });
    expect(addRes.status).toBe(201);
    const memberId = addRes.body.id;

    const editRes = await residentAgent
      .patch(`/api/households/${household.householdId}/members/${memberId}`)
      .send({ name: "Juan dela Cruz", relation: "Brother" });
    expect(editRes.status).toBe(200);
    expect(editRes.body.name).toBe("Juan dela Cruz");
    expect(editRes.body.relation).toBe("Brother");
    expect(editRes.body.age).toBe(30);

    const members = await prisma.familyMember.findMany({ where: { householdId: household.householdId } });
    expect(members.length).toBe(1);
    expect(members[0].id).toBe(memberId);
    expect(members[0].name).toBe("Juan dela Cruz");
  });

  it("a resident can remove their own family member, and only that record is affected", async () => {
    const purok = await createTestPurok(nextRunId());
    const household = await createTestHousehold(purok);
    const residentAgent = await loginAs(household.residentUsername, TEST_PASSWORD);

    const keep = await residentAgent
      .post(`/api/households/${household.householdId}/members`)
      .send({ name: "Keep Me", relation: "Sibling", age: 20 });
    const remove = await residentAgent
      .post(`/api/households/${household.householdId}/members`)
      .send({ name: "Remove Me", relation: "Cousin", age: 25 });

    const deleteRes = await residentAgent.delete(
      `/api/households/${household.householdId}/members/${remove.body.id}`,
    );
    expect(deleteRes.status).toBe(204);

    const members = await prisma.familyMember.findMany({ where: { householdId: household.householdId } });
    expect(members.length).toBe(1);
    expect(members[0].id).toBe(keep.body.id);

    const householdRow = await prisma.household.findUniqueOrThrow({ where: { id: household.householdId } });
    expect(householdRow.removedAt).toBeNull();
    const residentUser = await prisma.user.findFirst({ where: { username: household.residentUsername } });
    expect(residentUser).not.toBeNull();
  });

  it("a resident from another household cannot edit or remove a different household's family member", async () => {
    const purokA = await createTestPurok(nextRunId());
    const householdA = await createTestHousehold(purokA);
    const residentA = await loginAs(householdA.residentUsername, TEST_PASSWORD);
    const addRes = await residentA
      .post(`/api/households/${householdA.householdId}/members`)
      .send({ name: "Household A Member", relation: "Sibling", age: 18 });
    const memberId = addRes.body.id;

    const purokB = await createTestPurok(nextRunId());
    const householdB = await createTestHousehold(purokB);
    const residentB = await loginAs(householdB.residentUsername, TEST_PASSWORD);

    const editAttempt = await residentB
      .patch(`/api/households/${householdA.householdId}/members/${memberId}`)
      .send({ name: "Hijacked" });
    expect(editAttempt.status).toBe(404);

    const deleteAttempt = await residentB.delete(
      `/api/households/${householdA.householdId}/members/${memberId}`,
    );
    expect(deleteAttempt.status).toBe(404);

    // Also attempt the described concrete attack: B's own household id in
    // the URL, but A's memberId — must still be rejected even though B
    // legitimately owns that household id.
    const crossAttempt = await residentB
      .patch(`/api/households/${householdB.householdId}/members/${memberId}`)
      .send({ name: "Hijacked Again" });
    expect(crossAttempt.status).toBe(404);

    const untouched = await prisma.familyMember.findUniqueOrThrow({ where: { id: memberId } });
    expect(untouched.name).toBe("Household A Member");
  });
});
