"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Loader2, MailCheck, Recycle } from "lucide-react";
import { api, ApiError } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.forgotPassword(email.trim());
      setSent(true);
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

        {sent ? (
          <div className="text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-pine/10 text-pine">
              <MailCheck size={22} />
            </div>
            <h2 className="mt-4 font-[family-name:var(--font-display)] text-2xl font-semibold text-ink">
              Check your email
            </h2>
            <p className="mt-1.5 text-sm text-ink/55">
              If an account exists for <span className="font-medium text-ink">{email}</span>, we&apos;ve sent a
              link to reset your password. It expires in 30 minutes.
            </p>
            <Link
              href="/login"
              className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-pine hover:text-pine-dark"
            >
              <ArrowLeft size={15} /> Back to sign in
            </Link>
          </div>
        ) : (
          <>
            <p className="stamp text-[11px] font-medium text-pine">Reset password</p>
            <h2 className="mt-1 font-[family-name:var(--font-display)] text-2xl font-semibold text-ink">
              Forgot your password?
            </h2>
            <p className="mt-1.5 text-sm text-ink/55">
              Enter the email on your account and we&apos;ll send you a link to reset it.
            </p>

            <form onSubmit={handleSubmit} className="mt-7 space-y-3.5">
              <div>
                <label htmlFor="email" className="text-xs font-medium text-ink/55">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                  className="mt-1 w-full rounded-xl border border-line bg-paper px-3.5 py-2.5 text-sm text-ink outline-none focus:border-pine"
                  placeholder="you@example.com"
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
                    <Loader2 size={15} className="animate-spin" /> Sending…
                  </>
                ) : (
                  <>
                    Send reset link <ArrowRight size={15} />
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
