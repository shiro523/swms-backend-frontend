"use client";

import { ReactNode } from "react";
import { Loader2, TriangleAlert } from "lucide-react";
import type { AsyncQuery } from "@/hooks/useApi";

function Loading() {
  return (
    <div className="flex items-center justify-center gap-2 rounded-2xl border border-line bg-paper py-16 text-sm text-ink/45">
      <Loader2 size={16} className="animate-spin" />
      Loading…
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-clay/30 bg-clay-tint/40 py-16 text-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-clay-tint text-clay">
        <TriangleAlert size={18} />
      </span>
      <div>
        <p className="text-sm font-semibold text-ink">Something went wrong</p>
        <p className="mt-1 max-w-sm text-sm text-ink/55">{message}</p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="rounded-lg border border-line bg-paper px-3.5 py-2 text-[13px] font-medium text-ink/70 hover:border-pine/40"
        >
          Try again
        </button>
      )}
    </div>
  );
}

/**
 * Renders loading and error states for an {@link AsyncQuery}, and calls
 * `children` with the resolved data once available.
 */
export function AsyncSection<T>({
  query,
  children,
}: {
  query: AsyncQuery<T>;
  children: (data: T) => ReactNode;
}) {
  if (query.error) return <ErrorState message={query.error} onRetry={query.reload} />;
  if (query.loading || query.data === undefined) return <Loading />;
  return <>{children(query.data)}</>;
}
