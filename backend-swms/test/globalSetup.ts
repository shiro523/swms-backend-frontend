// Fail-closed gate for the automated test suite, run once before any test
// file is loaded (and therefore before src/lib/prisma.ts's module-level
// PrismaClient construction can ever happen). Deliberately does NOT inspect
// DATABASE_URL's hostname/content to decide "is this production" — a
// database's identity can't be safely inferred from its connection string
// alone, and hardcoding either the real or the test URL here would defeat
// the whole point of keeping them out of source control. Instead this
// checks two signals:
//   1. NODE_ENV=test — a basic sanity check, kept as defense-in-depth. Note
//      Vitest itself defaults NODE_ENV to "test" when nothing else sets it,
//      so this alone does NOT reliably distinguish `npm test` from a bare
//      `vitest run` — it only refuses if something has explicitly forced a
//      non-test NODE_ENV (e.g. a misconfigured NODE_ENV=production in CI).
//   2. TEST_DB_CONFIRM=true — the real fail-closed signal. It lives only in
//      backend-swms/.env.test (never in .env/.env.example), so this is what
//      actually refuses to run whenever an isolated test environment wasn't
//      deliberately configured, regardless of how the runner was invoked.
import "dotenv/config";

export default function globalSetup(): void {
  if (process.env.NODE_ENV !== "test") {
    console.error(
      "\nRefusing to run: NODE_ENV is not \"test\".\n\n" +
        "Automated tests must run with NODE_ENV=test. Use `npm test`, which sets " +
        "this and loads backend-swms/.env.test.\n",
    );
    process.exit(1);
  }

  if (process.env.TEST_DB_CONFIRM !== "true") {
    console.error(
      "\nRefusing to run: backend-swms/.env.test is missing or incomplete.\n\n" +
        "Automated tests require backend-swms/.env.test to exist and to set " +
        "TEST_DB_CONFIRM=true alongside an isolated test DATABASE_URL. This file " +
        "is never committed — copy backend-swms/.env.test.example to " +
        "backend-swms/.env.test and fill in your own isolated test database " +
        "connection string.\n",
    );
    process.exit(1);
  }

  if (!process.env.DATABASE_URL) {
    console.error("\nRefusing to run: DATABASE_URL is not set in backend-swms/.env.test.\n");
    process.exit(1);
  }
}
