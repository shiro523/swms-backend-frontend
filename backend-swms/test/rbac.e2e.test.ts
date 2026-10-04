// End-to-end RBAC walkthrough: every role logs in through the real API and
// exercises each feature it is allowed to use, and every cross-role or
// cross-purok attempt is checked to be refused. Runs against the isolated
// test database only (see helpers/testGuard.ts); everything it creates is
// removed in afterAll.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import app from "@/app";
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
import { newTestRunId, testEmail, testUsername } from "./helpers/ids";
import { loginAs } from "./helpers/auth";

type Agent = Awaited<ReturnType<typeof loginAs>>;

describe("RBAC end-to-end, from login", () => {
  const runIds: string[] = [];
  function nextRunId(): string {
    const id = newTestRunId();
    runIds.push(id);
    return id;
  }

  let purokA: TestPurokFixture;
  let purokB: TestPurokFixture;
  let hhA1: TestHouseholdFixture;
  let hhA2: TestHouseholdFixture;
  let hhB1: TestHouseholdFixture;
  let adminUsername: string;
  let currentPeriod: string;

  // Created through the API during the run; removed in afterAll.
  let adminCreatedPurokId: string | null = null;
  let purokANoticeId: string | null = null;
  let leaderOnlyViolationId: string | null = null;
  let originalSettings: Awaited<ReturnType<typeof prisma.systemSettings.findUnique>> = null;

  beforeAll(async () => {
    purokA = await createTestPurok(nextRunId());
    purokB = await createTestPurok(nextRunId());
    hhA1 = await createTestHousehold(purokA, 1);
    hhA2 = await createTestHousehold(purokA, 2);
    hhB1 = await createTestHousehold(purokB, 1);
    adminUsername = (await createTestAdmin(nextRunId())).username;
    originalSettings = await prisma.systemSettings.findUnique({ where: { id: 1 } });
  });

  afterAll(async () => {
    if (purokANoticeId) await prisma.notification.deleteMany({ where: { id: purokANoticeId } });
    if (adminCreatedPurokId) {
      await prisma.user.deleteMany({ where: { purokId: adminCreatedPurokId } });
      await prisma.purok.deleteMany({ where: { id: adminCreatedPurokId } });
    }
    if (originalSettings) {
      const { id: _id, updatedAt: _updatedAt, ...rest } = originalSettings;
      await prisma.systemSettings.update({ where: { id: 1 }, data: rest });
    }
    for (const id of runIds) {
      await cleanupTestRun(id);
    }
    await prisma.$disconnect();
  });

  const ids = (body: { id: string }[]) => body.map((r) => r.id).sort();

  async function expectStatus(agent: Agent, method: "get" | "post" | "patch" | "delete", url: string, status: number, body?: object) {
    const res = await agent[method](url).send(body ?? {});
    expect(res.status, `${method.toUpperCase()} ${url}`).toBe(status);
    return res;
  }

  describe("signed out", () => {
    it("every protected endpoint refuses, and a wrong password is rejected", async () => {
      for (const url of ["/api/auth/me", "/api/households", "/api/payments", "/api/trash-logs", "/api/notifications", "/api/settings"]) {
        expect((await request(app).get(url)).status, url).toBe(401);
      }
      const bad = await request(app).post("/api/auth/login").send({ username: hhA1.residentUsername, password: "wrong-password" });
      expect(bad.status).toBe(401);
    });

    it("the login page's public totals are readable, and expose aggregate counts only", async () => {
      const res = await request(app).get("/api/stats/public");
      expect(res.status).toBe(200);
      expect(Object.keys(res.body).sort()).toEqual(["complianceRate", "households", "puroks"]);
      // Other test files add/remove rows in parallel, so exact global counts
      // can shift between this request and a recount — check the values are
      // real counts that include this file's own fixtures instead.
      expect(Number.isInteger(res.body.households)).toBe(true);
      expect(res.body.households).toBeGreaterThanOrEqual(3);
      expect(res.body.puroks).toBeGreaterThanOrEqual(2);
      expect(res.body.complianceRate === null || (res.body.complianceRate >= 0 && res.body.complianceRate <= 100)).toBe(true);
    });
  });

  describe("admin", () => {
    let admin: Agent;
    beforeAll(async () => {
      admin = await loginAs(adminUsername, TEST_PASSWORD);
      currentPeriod = (await admin.get("/api/payments/current-period")).body.period;
    });

    it("logs in as admin and can read every barangay-wide list", async () => {
      expect((await admin.get("/api/auth/me")).body.user.role).toBe("admin");
      const households = (await expectStatus(admin, "get", "/api/households", 200)).body;
      expect(households.map((h: { id: string }) => h.id)).toEqual(
        expect.arrayContaining([hhA1.householdId, hhA2.householdId, hhB1.householdId]),
      );
      const puroks = (await expectStatus(admin, "get", "/api/puroks", 200)).body;
      expect(puroks.map((p: { id: string }) => p.id)).toEqual(expect.arrayContaining([purokA.purokId, purokB.purokId]));
      for (const url of [
        "/api/trash-logs",
        "/api/payments",
        "/api/violations",
        "/api/notifications",
        "/api/settings",
        "/api/stats/admin-dashboard",
        "/api/stats/monthly-collection",
        "/api/stats/payment-collection",
        "/api/trash-logs/collection-week",
      ]) {
        await expectStatus(admin, "get", url, 200);
      }
      const accounts = (await expectStatus(admin, "get", `/api/puroks/${purokA.purokId}/accounts`, 200)).body;
      expect(accounts.leader.username).toBe(purokA.leaderUsername);
    });

    it("manages puroks: create, rename, archive, restore", async () => {
      const runId = nextRunId();
      const created = await expectStatus(admin, "post", "/api/puroks", 201, {
        name: `E2E Purok ${runId}`,
        leaderName: "E2E Leader",
        username: testUsername(runId, "leader"),
        password: TEST_PASSWORD,
        email: testEmail(runId, "leader"),
      });
      adminCreatedPurokId = created.body.id;
      expect(created.body.complianceRate).toBeNull();
      expect(created.body.households).toBe(0);

      await expectStatus(admin, "patch", `/api/puroks/${adminCreatedPurokId}`, 200, { name: `E2E Purok ${runId} renamed` });
      await expectStatus(admin, "post", `/api/puroks/${adminCreatedPurokId}/archive`, 200);
      const archived = (await admin.get("/api/puroks?archived=true")).body;
      expect(archived.map((p: { id: string }) => p.id)).toContain(adminCreatedPurokId);
      await expectStatus(admin, "post", `/api/puroks/${adminCreatedPurokId}/restore`, 200);
    });

    it("cannot register households (purok-leader only)", async () => {
      await expectStatus(admin, "post", "/api/households", 403, {});
    });

    it("updates settings", async () => {
      const current = (await admin.get("/api/settings")).body;
      await expectStatus(admin, "patch", "/api/settings", 200, {
        barangayName: current.barangayName || "Test Barangay",
        municipality: current.municipality || "Test Municipality",
        contactNumber: /^\d{1,11}$/.test(current.contactNumber) ? current.contactNumber : "09000000000",
        monthlyCollectionFee: current.monthlyCollectionFee,
        collectionDays: "Sunday",
        collectionTime: current.collectionTime || "6:00 AM",
      });
    });

    it("sends a purok-targeted notification", async () => {
      const res = await expectStatus(admin, "post", "/api/notifications", 201, {
        type: "collection",
        message: "E2E notice for purok A",
        targetPurokId: purokA.purokId,
      });
      purokANoticeId = res.body.id;
    });

    it("records a payment, corrects its period, logs a scan, and removes/restores a household", async () => {
      const pay = await expectStatus(admin, "post", "/api/payments", 201, {
        householdId: hhB1.householdId,
        period: currentPeriod,
        amount: 50,
      });
      await expectStatus(admin, "patch", `/api/payments/${pay.body.id}/period`, 200, { period: currentPeriod });
      await expectStatus(admin, "post", "/api/trash-logs", 201, {
        householdId: hhB1.householdId,
        status: "compliant",
        disposedBy: "owner",
      });
      await expectStatus(admin, "post", `/api/households/${hhA2.householdId}/remove`, 200, { reason: "E2E removal" });
      await expectStatus(admin, "post", `/api/households/${hhA2.householdId}/restore`, 200);
    });

    it("logs out, and the session stops working", async () => {
      const agent = await loginAs(adminUsername, TEST_PASSWORD);
      await expectStatus(agent, "post", "/api/auth/logout", 200);
      await expectStatus(agent, "get", "/api/auth/me", 401);
    });
  });

  describe("purok leader", () => {
    let leaderA: Agent;
    beforeAll(async () => {
      leaderA = await loginAs(purokA.leaderUsername, TEST_PASSWORD);
    });

    it("logs in as purok-leader and only sees their own purok", async () => {
      expect((await leaderA.get("/api/auth/me")).body.user.role).toBe("purok-leader");
      expect(ids((await leaderA.get("/api/puroks")).body)).toEqual([purokA.purokId]);
      const households = ids((await leaderA.get("/api/households")).body);
      expect(households).toEqual([hhA1.householdId, hhA2.householdId].sort());
      const lists = await Promise.all(["/api/trash-logs", "/api/payments", "/api/violations"].map((u) => leaderA.get(u)));
      for (const res of lists) {
        for (const row of res.body) expect([hhA1.householdId, hhA2.householdId]).toContain(row.householdId);
      }
    });

    it("cannot read or touch another purok's household", async () => {
      await expectStatus(leaderA, "get", `/api/households/${hhB1.householdId}`, 404);
      await expectStatus(leaderA, "patch", `/api/households/${hhB1.householdId}`, 404, { address: "Hijack" });
      await expectStatus(leaderA, "post", "/api/trash-logs", 404, { householdId: hhB1.householdId, status: "compliant", disposedBy: "owner" });
      await expectStatus(leaderA, "post", "/api/payments", 404, { householdId: hhB1.householdId, period: currentPeriod, amount: 50 });
      await expectStatus(leaderA, "post", `/api/households/${hhB1.householdId}/remove`, 404, { reason: "x" });
      expect((await leaderA.get(`/api/trash-logs?householdId=${hhB1.householdId}`)).body).toEqual([]);
      expect((await leaderA.get(`/api/payments?householdId=${hhB1.householdId}`)).body).toEqual([]);
    });

    it("is refused every admin-only action", async () => {
      await expectStatus(leaderA, "get", "/api/settings", 403);
      await expectStatus(leaderA, "patch", "/api/settings", 403, {});
      await expectStatus(leaderA, "get", "/api/stats/admin-dashboard", 403);
      await expectStatus(leaderA, "post", "/api/puroks", 403, {});
      await expectStatus(leaderA, "patch", `/api/puroks/${purokA.purokId}`, 403, { name: "x" });
      await expectStatus(leaderA, "post", `/api/puroks/${purokA.purokId}/archive`, 403);
      await expectStatus(leaderA, "get", `/api/puroks/${purokA.purokId}/accounts`, 403);
      await expectStatus(leaderA, "post", "/api/notifications", 403, { type: "collection", message: "x" });
      await expectStatus(leaderA, "post", `/api/households/${hhA1.householdId}/restore`, 403);
      await expectStatus(leaderA, "delete", `/api/households/${hhA1.householdId}`, 403);
      await expectStatus(leaderA, "patch", "/api/payments/any-id/period", 403, { period: currentPeriod });
    });

    it("registers a household into their own purok, even if another purok is requested", async () => {
      const runId = purokA.runId;
      const res = await expectStatus(leaderA, "post", "/api/households", 201, {
        representative: "E2E Registered",
        address: "1 E2E Street",
        contactNumber: "09171234567",
        purokId: purokB.purokId,
        members: [{ name: "E2E Child", relation: "Child", age: 7 }],
        username: testUsername(runId, "resident", 9),
        password: TEST_PASSWORD,
        email: testEmail(runId, "resident", 9),
      });
      expect(res.body.purokId).toBe(purokA.purokId);
      expect(res.body.periodPaymentStatus).toBe("new");
      expect(res.body.hasCollectionRecords).toBe(false);
    });

    it("scans a violation, completes it, and is limited to one log per week", async () => {
      await expectStatus(leaderA, "post", "/api/trash-logs", 201, { householdId: hhA2.householdId, status: "violation", disposedBy: "owner" });
      await expectStatus(leaderA, "post", "/api/trash-logs", 409, { householdId: hhA2.householdId, status: "compliant", disposedBy: "owner" });
      const violations = (await leaderA.get(`/api/violations?householdId=${hhA2.householdId}`)).body;
      expect(violations).toHaveLength(1);
      leaderOnlyViolationId = violations[0].id;
      const done = await expectStatus(leaderA, "patch", `/api/violations/${leaderOnlyViolationId}/complete`, 200);
      expect(done.body.status).toBe("completed");
    });

    it("records a payment for their own household", async () => {
      const res = await expectStatus(leaderA, "post", "/api/payments", 201, { householdId: hhA1.householdId, period: currentPeriod, amount: 50 });
      expect(res.body.householdId).toBe(hhA1.householdId);
      const hh = (await leaderA.get(`/api/households/${hhA1.householdId}`)).body;
      expect(hh.periodPaymentStatus).toBe("paid");
    });

    it("sees their purok's notice; the other purok's leader does not", async () => {
      const mine = (await leaderA.get("/api/notifications")).body.map((n: { id: string }) => n.id);
      expect(mine).toContain(purokANoticeId);
      const leaderB = await loginAs(purokB.leaderUsername, TEST_PASSWORD);
      const theirs = (await leaderB.get("/api/notifications")).body.map((n: { id: string }) => n.id);
      expect(theirs).not.toContain(purokANoticeId);
      expect(ids((await leaderB.get("/api/households")).body)).toEqual([hhB1.householdId]);
      await expectStatus(leaderB, "patch", `/api/violations/${leaderOnlyViolationId}/complete`, 404);
    });
  });

  describe("resident", () => {
    let resident: Agent;
    beforeAll(async () => {
      resident = await loginAs(hhA1.residentUsername, TEST_PASSWORD);
    });

    it("logs in as resident and only sees their own household's records", async () => {
      expect((await resident.get("/api/auth/me")).body.user.role).toBe("resident");
      expect(ids((await resident.get("/api/households")).body)).toEqual([hhA1.householdId]);
      for (const url of ["/api/trash-logs", "/api/payments", "/api/violations"]) {
        for (const row of (await resident.get(url)).body) expect(row.householdId, url).toBe(hhA1.householdId);
      }
      expect((await resident.get("/api/payments")).body.length).toBeGreaterThan(0);
      await expectStatus(resident, "get", "/api/trash-logs/collection-week", 200);
      await expectStatus(resident, "get", "/api/payments/current-period", 200);
    });

    it("cannot read or change other households", async () => {
      await expectStatus(resident, "get", `/api/households/${hhA2.householdId}`, 404);
      await expectStatus(resident, "patch", `/api/households/${hhA2.householdId}`, 404, { address: "Hijack" });
      await expectStatus(resident, "post", `/api/households/${hhA2.householdId}/members`, 404, { name: "X", age: 3 });
      for (const url of ["trash-logs", "payments", "violations"]) {
        expect((await resident.get(`/api/${url}?householdId=${hhA2.householdId}`)).body, url).toEqual([]);
      }
    });

    it("is refused every staff and admin action", async () => {
      await expectStatus(resident, "post", "/api/trash-logs", 403, { householdId: hhA1.householdId, status: "compliant" });
      await expectStatus(resident, "post", "/api/payments", 403, { householdId: hhA1.householdId, period: currentPeriod, amount: 1 });
      await expectStatus(resident, "patch", `/api/violations/${leaderOnlyViolationId}/complete`, 403);
      await expectStatus(resident, "post", "/api/households", 403, {});
      await expectStatus(resident, "post", `/api/households/${hhA1.householdId}/remove`, 403, { reason: "x" });
      await expectStatus(resident, "get", "/api/puroks", 403);
      await expectStatus(resident, "get", "/api/settings", 403);
      await expectStatus(resident, "get", "/api/stats/admin-dashboard", 403);
      await expectStatus(resident, "post", "/api/notifications", 403, { type: "collection", message: "x" });
    });

    it("edits their own profile and family members", async () => {
      const res = await expectStatus(resident, "patch", `/api/households/${hhA1.householdId}`, 200, {
        representative: "E2E Resident Renamed",
        contactNumber: "09998887777",
      });
      expect(res.body.contactNumber).toBe("09998887777");
      expect((await resident.get("/api/auth/me")).body.user.name).toBe("E2E Resident Renamed");
      await expectStatus(resident, "patch", `/api/households/${hhA1.householdId}`, 400, { contactNumber: "09abc" });
      const member = await expectStatus(resident, "post", `/api/households/${hhA1.householdId}/members`, 201, {
        name: "E2E Member",
        relation: "Sibling",
        age: 12,
      });
      await expectStatus(resident, "delete", `/api/households/${hhA1.householdId}/members/${member.body.id}`, 204);
    });

    it("sees their purok's notice (not leader-only alerts) and can mark it read", async () => {
      const notes = (await resident.get("/api/notifications")).body;
      expect(notes.map((n: { id: string }) => n.id)).toContain(purokANoticeId);
      const leaderOnlyAlerts = await prisma.notification.findMany({ where: { targetPurokId: purokA.purokId, leaderOnly: true } });
      for (const alert of leaderOnlyAlerts) expect(notes.map((n: { id: string }) => n.id)).not.toContain(alert.id);

      const before = (await resident.get("/api/notifications/unread-count")).body.count;
      await expectStatus(resident, "patch", `/api/notifications/${purokANoticeId}/read`, 200);
      const after = (await resident.get("/api/notifications/unread-count")).body.count;
      expect(after).toBe(before - 1);
    });
  });

  describe("lifecycle lock-outs", () => {
    it("a removed household's resident can no longer use the app", async () => {
      const resident = await loginAs(hhA2.residentUsername, TEST_PASSWORD);
      await expectStatus(resident, "get", "/api/auth/me", 200);
      const leaderA = await loginAs(purokA.leaderUsername, TEST_PASSWORD);
      await expectStatus(leaderA, "post", `/api/households/${hhA2.householdId}/remove`, 200, { reason: "E2E lock-out" });
      await expectStatus(resident, "get", "/api/households", 401);
      // Removed households drop out of the leader's active list.
      expect(ids((await leaderA.get("/api/households")).body)).not.toContain(hhA2.householdId);
    });

    it("an archived purok's leader loses access to its data until restored", async () => {
      const leaderB = await loginAs(purokB.leaderUsername, TEST_PASSWORD);
      const admin = await loginAs(adminUsername, TEST_PASSWORD);
      await expectStatus(admin, "post", `/api/puroks/${purokB.purokId}/archive`, 200);
      expect((await leaderB.get("/api/households")).body).toEqual([]);
      await expectStatus(leaderB, "get", `/api/households/${hhB1.householdId}`, 404);
      await expectStatus(admin, "post", `/api/puroks/${purokB.purokId}/restore`, 200);
      expect(ids((await leaderB.get("/api/households")).body)).toEqual([hhB1.householdId]);
    });
  });
});
