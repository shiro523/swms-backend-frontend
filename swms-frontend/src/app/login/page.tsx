import { LoginForm, type LoginStats } from "./LoginForm";

// Rendered per request so the totals are always current.
export const dynamic = "force-dynamic";

// Same backend the /api rewrite in next.config.ts points at.
const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";

// Live totals for the left panel. Never blocks sign-in: if the backend is
// unreachable or slow, the panel just shows "—".
async function getLoginStats(): Promise<LoginStats | null> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/stats/public`, {
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    });
    return res.ok ? ((await res.json()) as LoginStats) : null;
  } catch {
    return null;
  }
}

// Server-only — never bundled to the client. Deliberately not prefixed
// NEXT_PUBLIC_: that prefix means "ship this value to every browser," which
// is exactly what a page listing real account passwords must not do. Set
// SHOW_DEMO_LOGINS=true in swms-frontend/.env.local for local/capstone use
// only; leave it unset in any real deployment.
const DEMO_ACCOUNTS =
  process.env.SHOW_DEMO_LOGINS === "true"
    ? [
        { label: "Admin", username: "reyinoc", password: "12345678" },
        { label: "Purok Leader", username: "crisler", password: "12345678" },
        { label: "Resident", username: "jemarlee", password: "12345678" },
      ]
    : [];

export default async function LoginPage() {
  return <LoginForm demoAccounts={DEMO_ACCOUNTS} stats={await getLoginStats()} />;
}
