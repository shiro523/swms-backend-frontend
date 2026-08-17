"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/lib/api";

export interface AsyncQuery<T> {
  data?: T;
  loading: boolean;
  error?: string;
  reload: () => void;
}

/**
 * Fetch data from the API inside a client component. Pass a stable `deps` array
 * (like useEffect) that lists everything the fetcher closes over.
 *
 *   const q = useApi(() => api.households(), []);
 */
export function useApi<T>(fetcher: () => Promise<T>, deps: unknown[] = []): AsyncQuery<T> {
  const [data, setData] = useState<T>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [tick, setTick] = useState(0);

  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;

    // Kept inside an async routine (not the effect body) so state updates happen
    // as the request settles rather than synchronously on commit.
    void (async () => {
      setLoading(true);
      setError(undefined);
      try {
        const result = await fetcher();
        if (!cancelled) setData(result);
      } catch (err: unknown) {
        if (cancelled) return;
        setError(
          err instanceof ApiError
            ? err.message
            : "Couldn't reach the server. Is the backend running?",
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  return { data, loading, error, reload };
}
