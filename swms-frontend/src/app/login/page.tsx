import { LoginForm } from "./LoginForm";

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
        { label: "Resident", username: "jemar", password: "12345678" },
      ]
    : [];

export default function LoginPage() {
  return <LoginForm demoAccounts={DEMO_ACCOUNTS} />;
}
