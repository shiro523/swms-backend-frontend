// Tier 1 authorization coverage: two distinct concerns kept in separate
// describe blocks, matching how this codebase itself separates them
// (requireRole() in the route layer vs. canAccessHousehold()/scope.ts in
// the service layer).
//
//   - "role boundaries": can this ROLE call this endpoint at all.
//   - "scope isolation": within an allowed role, can this SPECIFIC user
//     reach another user's data (a different household/purok).
//
// Every check goes through the real HTTP endpoints and real middleware —
// no direct service/repository calls, no fabricated JWTs.
import { afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import app from "@/app";
import { prisma } from "@/lib/prisma";
import { createTestAdmin, createTestHousehold, createTestPurok, TEST_PASSWORD } from "./helpers/fixtures";
import { cleanupTestRun } from "./helpers/cleanup";
import { newTestRunId } from "./helpers/ids";
import { loginAs } from "./helpers/auth";

describe("authorization", () => {
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

  describe("role boundaries", () => {
    it("unauthenticated requests cannot reach protected endpoints", async () => {
      const res = await request(app).get("/api/households");
      expect(res.status).toBe(401);
    });

    it("admin can create a purok (admin-only operation); purok-leader and resident cannot", async () => {
      const admin = await createTestAdmin(nextRunId());
      const purok = await createTestPurok(nextRunId());
      const household = await createTestHousehold(await createTestPurok(nextRunId()));

      const adminAgent = await loginAs(admin.username, TEST_PASSWORD);
      const leaderAgent = await loginAs(purok.leaderUsername, TEST_PASSWORD);
      const residentAgent = await loginAs(household.residentUsername, TEST_PASSWORD);

      const newPurokBody = {
        name: "Authz Test Purok",
        leaderName: "Authz Test Leader",
        username: `test-${nextRunId()}-newleader`,
        password: TEST_PASSWORD,
        email: `test-authz-newleader-${Date.now()}@example-test.invalid`,
      };

      const asAdmin = await adminAgent.post("/api/puroks").send(newPurokBody);
      expect(asAdmin.status).toBe(201);
      // Created via a raw endpoint call, not the fixture helper — clean it
      // up directly rather than leaving it for a runId-scoped cleanup that
      // was never told about this id.
      await prisma.user.delete({ where: { username: newPurokBody.username } });
      await prisma.purok.delete({ where: { id: asAdmin.body.id } });

      const asLeader = await leaderAgent.post("/api/puroks").send({ ...newPurokBody, username: `${newPurokBody.username}-2` });
      expect(asLeader.status).toBe(403);

      const asResident = await residentAgent.post("/api/puroks").send({ ...newPurokBody, username: `${newPurokBody.username}-3` });
      expect(asResident.status).toBe(403);
    });

    it("purok-leader can create a household (purok-leader-only operation); admin and resident cannot", async () => {
      const admin = await createTestAdmin(nextRunId());
      const purok = await createTestPurok(nextRunId());
      const otherHousehold = await createTestHousehold(await createTestPurok(nextRunId()));

      const adminAgent = await loginAs(admin.username, TEST_PASSWORD);
      const leaderAgent = await loginAs(purok.leaderUsername, TEST_PASSWORD);
      const residentAgent = await loginAs(otherHousehold.residentUsername, TEST_PASSWORD);

      const newHouseholdBody = {
        representative: "Authz Test Rep",
        address: "1 Authz Street",
        contactNumber: "09000000001",
        members: [],
        username: `test-${purok.runId}-newresident`,
        password: TEST_PASSWORD,
        email: `test-authz-newresident-${Date.now()}@example-test.invalid`,
      };

      const asLeader = await leaderAgent.post("/api/households").send(newHouseholdBody);
      expect(asLeader.status).toBe(201);
      await prisma.user.delete({ where: { username: newHouseholdBody.username } });
      await prisma.household.delete({ where: { id: asLeader.body.id } });

      const asAdmin = await adminAgent.post("/api/households").send({ ...newHouseholdBody, username: `${newHouseholdBody.username}-2`, purokId: purok.purokId });
      expect(asAdmin.status).toBe(403);

      const asResident = await residentAgent.post("/api/households").send({ ...newHouseholdBody, username: `${newHouseholdBody.username}-3` });
      expect(asResident.status).toBe(403);
    });
  });

  describe("scope isolation", () => {
    it("resident A cannot access household B's data", async () => {
      const householdA = await createTestHousehold(await createTestPurok(nextRunId()));
      const householdB = await createTestHousehold(await createTestPurok(nextRunId()));

      const residentA = await loginAs(householdA.residentUsername, TEST_PASSWORD);

      const ownHousehold = await residentA.get(`/api/households/${householdA.householdId}`);
      expect(ownHousehold.status).toBe(200);

      const otherHousehold = await residentA.get(`/api/households/${householdB.householdId}`);
      expect(otherHousehold.status).toBe(404);
    });

    it("purok-leader A cannot access or act on purok B's household", async () => {
      const purokA = await createTestPurok(nextRunId());
      const householdB = await createTestHousehold(await createTestPurok(nextRunId()));

      const leaderA = await loginAs(purokA.leaderUsername, TEST_PASSWORD);

      const getOther = await leaderA.get(`/api/households/${householdB.householdId}`);
      expect(getOther.status).toBe(404);

      const trashLogAttempt = await leaderA
        .post("/api/trash-logs")
        .send({ householdId: householdB.householdId, status: "compliant", disposedBy: "owner" });
      expect(trashLogAttempt.status).toBe(404);
    });

    it("admin can access household data across every purok", async () => {
      const admin = await createTestAdmin(nextRunId());
      const householdA = await createTestHousehold(await createTestPurok(nextRunId()));
      const householdB = await createTestHousehold(await createTestPurok(nextRunId()));

      const adminAgent = await loginAs(admin.username, TEST_PASSWORD);

      const getA = await adminAgent.get(`/api/households/${householdA.householdId}`);
      const getB = await adminAgent.get(`/api/households/${householdB.householdId}`);
      expect(getA.status).toBe(200);
      expect(getB.status).toBe(200);
    });
  });
});
