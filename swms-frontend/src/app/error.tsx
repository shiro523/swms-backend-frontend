"use client";

import { useEffect } from "react";
import { ErrorFallback } from "@/components/ui/ErrorFallback";

// Catches anything not already caught by a role-section error.tsx — mainly
// the routes outside admin/purok-leader/resident (login, forgot/reset
// password) plus a fallback of last resort.
export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <ErrorFallback reset={reset} />
    </div>
  );
}
