// Independent copy of the K-2 fail-closed check (globalSetup.ts), applied
// again at the point fixtures/cleanup actually touch the database. This is
// deliberate redundancy: globalSetup already refuses before any test file
// loads, but fixture helpers could in principle be imported and called from
// somewhere outside that guarded Vitest run (a stray script, a future
// helper). Every fixture/cleanup entry point calls this first so it refuses
// on its own, rather than trusting that globalSetup already ran.
export function assertTestEnvironmentActive(): void {
  if (process.env.TEST_DB_CONFIRM !== "true") {
    throw new Error(
      'Refusing to touch the database: TEST_DB_CONFIRM is not "true". Test fixtures and ' +
        "cleanup only run against the isolated database configured in backend-swms/.env.test.",
    );
  }
}
