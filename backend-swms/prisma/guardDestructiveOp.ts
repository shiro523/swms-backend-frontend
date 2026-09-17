// Shared safety gate for scripts that destroy data (wipe.ts, seed.ts). Both
// truncate every table in whatever database DATABASE_URL currently points to,
// so refusal here does not inspect the connection string at all — it only
// checks for a deliberate, separate opt-in. That way protection doesn't
// depend on remembering which Neon database is currently loaded, and a real
// production environment stays safe by default simply by never setting this.
const REQUIRED_VALUE = "yes-wipe-dev-db";

export function assertDestructiveOpsAllowed(scriptName: string): void {
  if (process.env.ALLOW_DESTRUCTIVE_DB_OPS === REQUIRED_VALUE) return;

  console.error(
    `\nRefusing to run "${scriptName}": this permanently deletes ALL data in whatever database DATABASE_URL currently points to.\n\n` +
      `To run it on purpose (your local/demo database only), add this line to backend-swms/.env:\n\n` +
      `  ALLOW_DESTRUCTIVE_DB_OPS=${REQUIRED_VALUE}\n\n` +
      `Then re-run the command. Do NOT set this in a production environment.\n`,
  );
  process.exit(1);
}
