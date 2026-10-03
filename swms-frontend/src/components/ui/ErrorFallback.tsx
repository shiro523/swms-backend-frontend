"use client";

import { RotateCcw, TriangleAlert } from "lucide-react";

export function ErrorFallback({ reset, homeHref }: { reset: () => void; homeHref?: string }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-line px-6 py-16 text-center">
      <TriangleAlert className="h-8 w-8 text-clay" strokeWidth={1.75} />
      <p className="font-[family-name:var(--font-display)] text-base font-semibold text-ink">
        Something went wrong
      </p>
      <p className="max-w-sm text-sm text-ink/55">
        This page hit an unexpected error. You can try again, or head back and continue from there.
      </p>
      <div className="mt-2 flex gap-2">
        <button
          onClick={reset}
          className="flex items-center gap-2 rounded-lg bg-pine px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-pine-dark"
        >
          <RotateCcw size={14} /> Try again
        </button>
        {homeHref && (
          <a
            href={homeHref}
            className="rounded-lg border border-line bg-paper px-3.5 py-2 text-[13px] font-medium text-ink/70 hover:border-pine/40"
          >
            Back to dashboard
          </a>
        )}
      </div>
    </div>
  );
}
