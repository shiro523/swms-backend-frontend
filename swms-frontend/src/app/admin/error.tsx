"use client";

import { useEffect } from "react";
import { ErrorFallback } from "@/components/ui/ErrorFallback";

// Nested under admin/layout.tsx, so the sidebar/topbar (RoleShell) stays
// mounted — only the broken page content is replaced.
export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return <ErrorFallback reset={reset} homeHref="/admin" />;
}
