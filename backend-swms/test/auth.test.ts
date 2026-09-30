// Tier 1 authentication regression coverage. Every test drives the real
// HTTP endpoints (POST /api/auth/login, /logout, GET /api/auth/me) — no JWT
// is ever fabricated by hand, so these tests exercise bcrypt comparison,
// cookie issuance, the rate limiter, and the tokenVersion check exactly as
// a real client would.
//
// Note on rate limiting (K-4 spec section 16): this file intentionally
// keeps failed-login attempts to the bare minimum (2 total: one wrong
// password, one missing-credentials request) rather than adding a
// dedicated rate-limit-exhaustion test. loginRateLimiter allows 10 *failed*
// attempts per 15 minutes per IP (skipSuccessfulRequests: true), and
// deliberately exhausting that budget here would make every other
// "invalid credentials -> 401" assertion in this same file non-deterministic
// depending on run order (a 429 instead of a 401). Vitest isolates each
// test file's module graph by default, so this file's Express app instance
// (and its in-memory rate-limiter counter) is independent of the other
// test files — the risk is only ever within this one file, not across the
// suite. Documenting this per the spec's explicit instruction to document
// rather than weaken the limiter.
import { createHash } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import app from "@/app";
import { prisma } from "@/lib/prisma";
import { createTestHousehold, createTestPurok, TEST_PASSWORD } from "./helpers/fixtures";
import { cleanupTestRun } from "./helpers/cleanup";
import { newTestRunId } from "./helpers/ids";
import { loginAs } from "./helpers/auth";

describe("authentication", () => {
  // Every test needs its own distinct runId (a shared one would collide on
  // the second createTestPurok call's `test-p-<runId>` primary key) —
  // tracked here so afterAll can clean up every one of them.
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

  it("valid login succeeds and returns the user, without tokenVersion", async () => {
    const purok = await createTestPurok(nextRunId());
    const res = await request(app)
      .post("/api/auth/login")
      .send({ username: purok.leaderUsername, password: TEST_PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.user.username).toBe(purok.leaderUsername);
    expect(res.body.user.role).toBe("purok-leader");
    expect(res.body.user.tokenVersion).toBeUndefined();
    expect(res.headers["set-cookie"]?.[0]).toContain("swms_token=");
  });

  it("rejects an invalid password", async () => {
    const purok = await createTestPurok(nextRunId());
    const res = await request(app)
      .post("/api/auth/login")
      .send({ username: purok.leaderUsername, password: "wrong-password" });
    expect(res.status).toBe(401);
  });

  it("rejects missing credentials", async () => {
    const res = await request(app).post("/api/auth/login").send({ username: "" });
    expect(res.status).toBe(400);
  });

  it("accepts an authenticated request with a valid session and rejects it unauthenticated", async () => {
    const purok = await createTestPurok(nextRunId());
    const agent = await loginAs(purok.leaderUsername, TEST_PASSWORD);

    const authed = await agent.get("/api/auth/me");
    expect(authed.status).toBe(200);
    expect(authed.body.user.username).toBe(purok.leaderUsername);

    const unauthed = await request(app).get("/api/auth/me");
    expect(unauthed.status).toBe(401);

    const unauthedProtected = await request(app).get("/api/households");
    expect(unauthedProtected.status).toBe(401);
  });

  it("logout invalidates the current session, a second concurrent session, and a fresh login still works", async () => {
    const purok = await createTestPurok(nextRunId());
    const sessionA = await loginAs(purok.leaderUsername, TEST_PASSWORD);
    const sessionB = await loginAs(purok.leaderUsername, TEST_PASSWORD);

    // Both sessions work before logout.
    expect((await sessionA.get("/api/auth/me")).status).toBe(200);
    expect((await sessionB.get("/api/auth/me")).status).toBe(200);

    const logoutRes = await sessionA.post("/api/auth/logout");
    expect(logoutRes.status).toBe(200);

    // Session A's own (now stale) cookie is rejected...
    const afterA = await sessionA.get("/api/auth/me");
    expect(afterA.status).toBe(401);

    // ...and so is session B's, even though B never called logout itself —
    // this is the specific regression this test exists to catch: logout
    // bumps tokenVersion, which invalidates every session for that user, not
    // just the one that called logout.
    const afterB = await sessionB.get("/api/auth/me");
    expect(afterB.status).toBe(401);

    // Logging in again issues a genuinely new, valid session.
    const sessionC = await loginAs(purok.leaderUsername, TEST_PASSWORD);
    const afterC = await sessionC.get("/api/auth/me");
    expect(afterC.status).toBe(200);
  });

  it("password reset invalidates existing sessions and the new password works", async () => {
    const household = await createTestHousehold(await createTestPurok(nextRunId()));
    const oldSession = await loginAs(household.residentUsername, TEST_PASSWORD);
    expect((await oldSession.get("/api/auth/me")).status).toBe(200);

    // No real SMTP inbox is available in this environment, so — mirroring
    // the exact precedent used in earlier live testing of this same
    // mechanism — this seeds the DB state that authService.forgotPassword's
    // setResetToken() would have written (a sha256 hash of the raw token,
    // not the raw token itself, matching auth.service.ts's hashToken()
    // exactly), then drives the real POST /auth/reset-password endpoint
    // with the corresponding raw token. The reset endpoint itself, and the
    // tokenVersion invalidation it triggers, are exercised for real.
    const rawToken = `test-reset-token-${household.runId}`;
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    await prisma.user.update({
      where: { username: household.residentUsername },
      data: { resetTokenHash: tokenHash, resetTokenExpiresAt: new Date(Date.now() + 30 * 60 * 1000) },
    });

    const newPassword = "Test-Fixture-New-Pass-2!";
    const resetRes = await request(app)
      .post("/api/auth/reset-password")
      .send({ token: rawToken, password: newPassword });
    expect(resetRes.status).toBe(200);

    // The session that was valid before the reset is now invalidated.
    const afterReset = await oldSession.get("/api/auth/me");
    expect(afterReset.status).toBe(401);

    // The old password no longer works; the new one does.
    const oldPasswordLogin = await request(app)
      .post("/api/auth/login")
      .send({ username: household.residentUsername, password: TEST_PASSWORD });
    expect(oldPasswordLogin.status).toBe(401);

    const newPasswordLogin = await request(app)
      .post("/api/auth/login")
      .send({ username: household.residentUsername, password: newPassword });
    expect(newPasswordLogin.status).toBe(200);
  });
});
