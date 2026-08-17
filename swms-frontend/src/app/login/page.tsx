"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Recycle, ArrowRight, Loader2, LockKeyhole } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { roleHome } from "@/lib/api";

const DEMO_ACCOUNTS = [
  { label: "Admin", username: "reyinoc", password: "12345678" },
  { label: "Purok Leader", username: "crisler", password: "12345678" },
  { label: "Resident", username: "jemarlee", password: "12345678" },
];

export default function LoginPage() {
  const { user, loading: authLoading, login } = useAuth();
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Already signed in? Skip the form.
  useEffect(() => {
    if (!authLoading && user) router.replace(roleHome(user.role));
  }, [authLoading, user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const signedIn = await login(username.trim(), password);
      router.replace(roleHome(signedIn.role));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed.");
      setSubmitting(false);
    }
  };

  const fillDemo = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
    setError(null);
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-pine-dark p-10 text-white lg:flex">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-pine/40 blur-3xl" />
        <div className="absolute -bottom-32 left-10 h-80 w-80 rounded-full bg-gold/10 blur-3xl" />

        <div className="relative flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10">
            <Recycle size={18} />
          </span>
          <p className="font-[family-name:var(--font-display)] text-sm font-semibold">
            Basura Watch
          </p>
        </div>

        <div className="relative max-w-md">
          <p className="stamp text-[11px] text-white/50">
            Barangay Smart Waste Management System
          </p>
          <h1 className="mt-3 font-[family-name:var(--font-display)] text-[34px] font-semibold leading-[1.15]">
            One QR sticker, per household, per bag.
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-white/70">
            Every household gets a unique QR code. Staff scan it on collection
            day to log compliance, catch violations, and keep payment records
            straight — no more guessing whose trash is whose.
          </p>
        </div>

        <div className="relative grid grid-cols-3 gap-4 border-t border-white/10 pt-6 text-sm">
          <div>
            <p className="font-[family-name:var(--font-display)] text-xl font-semibold">196</p>
            <p className="text-white/50">households</p>
          </div>
          <div>
            <p className="font-[family-name:var(--font-display)] text-xl font-semibold">5</p>
            <p className="text-white/50">puroks</p>
          </div>
          <div>
            <p className="font-[family-name:var(--font-display)] text-xl font-semibold">87%</p>
            <p className="text-white/50">compliance</p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-pine text-white">
              <Recycle size={18} />
            </span>
            <p className="font-[family-name:var(--font-display)] text-sm font-semibold">
              Basura Watch
            </p>
          </div>

          <p className="stamp text-[11px] font-medium text-pine">Sign in</p>
          <h2 className="mt-1 font-[family-name:var(--font-display)] text-2xl font-semibold text-ink">
            Welcome back
          </h2>
          <p className="mt-1.5 text-sm text-ink/55">
            Enter your account credentials to access your dashboard.
          </p>

          <form onSubmit={handleSubmit} className="mt-7 space-y-3.5">
            <div>
              <label htmlFor="username" className="text-xs font-medium text-ink/55">
                Username
              </label>
              <input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
                className="mt-1 w-full rounded-xl border border-line bg-paper px-3.5 py-2.5 text-sm text-ink outline-none focus:border-pine"
                placeholder="e.g. admin"
              />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="text-xs font-medium text-ink/55">
                  Password
                </label>
                <Link href="/forgot-password" className="text-xs font-medium text-pine hover:text-pine-dark">
                  Forgot password?
                </Link>
              </div>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                className="mt-1 w-full rounded-xl border border-line bg-paper px-3.5 py-2.5 text-sm text-ink outline-none focus:border-pine"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="rounded-lg border border-clay/30 bg-clay-tint px-3 py-2 text-xs text-clay">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-pine px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-pine-dark disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 size={15} className="animate-spin" /> Signing in…
                </>
              ) : (
                <>
                  Continue <ArrowRight size={15} />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 rounded-xl border border-line bg-panel/50 p-3.5">
            <p className="flex items-center gap-1.5 text-[11px] font-medium text-ink/50">
              <LockKeyhole size={12} /> Demo accounts — click to fill
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {DEMO_ACCOUNTS.map((a) => (
                <button
                  key={a.username}
                  type="button"
                  onClick={() => fillDemo(a.username, a.password)}
                  className="rounded-lg border border-line bg-paper px-2.5 py-1.5 text-[11px] font-medium text-ink/65 hover:border-pine/40 hover:text-pine-dark"
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
