"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, Recycle } from "lucide-react";
import { api, ApiError } from "@/lib/api";

export default function ResetPasswordPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setSubmitting(true);
    try {
      await api.resetPassword(token, password);
      setDone(true);
      setTimeout(() => router.replace("/login"), 2000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-pine text-white">
            <Recycle size={18} />
          </span>
          <p className="font-[family-name:var(--font-display)] text-sm font-semibold">Basura Watch</p>
        </div>

        {done ? (
          <div className="text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-pine/10 text-pine">
              <CheckCircle2 size={22} />
            </div>
            <h2 className="mt-4 font-[family-name:var(--font-display)] text-2xl font-semibold text-ink">
              Password reset
            </h2>
            <p className="mt-1.5 text-sm text-ink/55">Taking you to sign in…</p>
          </div>
        ) : (
          <>
            <p className="stamp text-[11px] font-medium text-pine">Reset password</p>
            <h2 className="mt-1 font-[family-name:var(--font-display)] text-2xl font-semibold text-ink">
              Choose a new password
            </h2>
            <p className="mt-1.5 text-sm text-ink/55">Must be at least 8 characters.</p>

            <form onSubmit={handleSubmit} className="mt-7 space-y-3.5">
              <div>
                <label htmlFor="password" className="text-xs font-medium text-ink/55">
                  New password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                  className="mt-1 w-full rounded-xl border border-line bg-paper px-3.5 py-2.5 text-sm text-ink outline-none focus:border-pine"
                  placeholder="••••••••"
                />
              </div>
              <div>
                <label htmlFor="confirmPassword" className="text-xs font-medium text-ink/55">
                  Confirm password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                  className="mt-1 w-full rounded-xl border border-line bg-paper px-3.5 py-2.5 text-sm text-ink outline-none focus:border-pine"
                  placeholder="••••••••"
                />
              </div>

              {error && (
                <p className="rounded-lg border border-clay/30 bg-clay-tint px-3 py-2 text-xs text-clay">{error}</p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-pine px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-pine-dark disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 size={15} className="animate-spin" /> Resetting…
                  </>
                ) : (
                  <>
                    Reset password <ArrowRight size={15} />
                  </>
                )}
              </button>
            </form>

            <Link
              href="/login"
              className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-ink/55 hover:text-ink"
            >
              <ArrowLeft size={15} /> Back to sign in
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
