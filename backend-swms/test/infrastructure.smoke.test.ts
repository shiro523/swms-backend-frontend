// The one infrastructure smoke test for this batch. It proves the chain
// Vitest -> .env.test -> isolated PostgreSQL -> Prisma -> synthetic fixture
// -> cleanup actually works end to end. It does not test business logic —
// that starts in K-4's dedicated test files, once this foundation is
// confirmed sound.
//
// K-4 correction: this test used to also assert that a *global* row count
// across every table returned to its pre-test baseline. That's only valid
// if this file has the database to itself — Vitest runs test files
// concurrently by default, and every file shares the same isolated Postgres
// database (module isolation gives each file its own app/rate-limiter
// instance, not its own database), so this file's "baseline" could already
// include another file's mid-flight fixtures, and its "after" count could
// be polluted the same way. That produced a real, reproducible flaky
// failure once K-4 introduced sibling test files. The fix is to only ever
// assert on this run's own exact, runId-scoped identifiers (the purok id
// and the leader's username) — never a table-wide count — which is exactly
// what the rest of this test already did before and after cleanup.
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { createTestPurok } from "./helpers/fixtures";
import { cleanupTestRun } from "./helpers/cleanup";
import { newTestRunId } from "./helpers/ids";

describe("test infrastructure", () => {
  const runId = newTestRunId();

  afterAll(async () => {
    // Safety net: removes this run's records even if an assertion above
    // threw before the test's own cleanup step ran. Idempotent — deleting
    // already-deleted rows is a no-op.
    await cleanupTestRun(runId);
    await prisma.$disconnect();
  });

  it("connects to the isolated test database, creates a synthetic fixture, reads it back, and cleanup removes exactly that fixture", async () => {
    // 1. Database connection works, and nothing with this run's identity
    // exists yet.
    const before = await prisma.purok.findUnique({ where: { id: `test-p-${runId}` } });
    expect(before).toBeNull();

    // 2. Create a synthetic fixture (a purok + its leader account) through
    // the real repository layer.
    const purok = await createTestPurok(runId);
    expect(purok.purokId).toBe(`test-p-${runId}`);

    // 3. Read it back.
    const foundPurok = await prisma.purok.findUnique({ where: { id: purok.purokId } });
    expect(foundPurok).not.toBeNull();
    expect(foundPurok?.name).toContain(runId);

    const foundLeader = await prisma.user.findUnique({ where: { username: purok.leaderUsername } });
    expect(foundLeader).not.toBeNull();
    expect(foundLeader?.role).toBe("purok-leader");
    expect(foundLeader?.purokId).toBe(purok.purokId);

    // 4. Cleanup removes exactly this fixture — checked by this run's own
    // exact ids, never a global table count, so this assertion can't be
    // affected by (and can't affect) any other test file's fixtures.
    await cleanupTestRun(runId);

    const afterPurok = await prisma.purok.findUnique({ where: { id: purok.purokId } });
    const afterLeader = await prisma.user.findUnique({ where: { username: purok.leaderUsername } });
    expect(afterPurok).toBeNull();
    expect(afterLeader).toBeNull();
  });
});
