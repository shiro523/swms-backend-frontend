import type { TrashLog } from "./types";

export interface WasteMonitoringSummary {
  total: number;
  compliant: number;
  violations: number;
  missed: number;
  mostRecent: TrashLog | null;
}

// Pure summary derived entirely from a household's own TrashLog rows —
// never a separate statistic, so it can never drift from what the
// Trash Logs list itself shows.
export function summarizeTrashLogs(logs: TrashLog[]): WasteMonitoringSummary {
  let mostRecent: TrashLog | null = null;
  for (const log of logs) {
    if (!mostRecent || log.date > mostRecent.date) mostRecent = log;
  }
  return {
    total: logs.length,
    compliant: logs.filter((l) => l.status === "compliant").length,
    violations: logs.filter((l) => l.status === "violation").length,
    missed: logs.filter((l) => l.status === "missed").length,
    mostRecent,
  };
}
