import { toPhDate } from "./dateTime";

// Local calendar date as YYYY-MM-DD — deliberately NOT toISOString().slice(0,10),
// which reads the UTC calendar date and can show a day behind for a user in
// the Philippines (UTC+8) completing something in the early morning.
// Mirrors the exact pattern already established in admin/trash-logs and
// purok-leader/scan. resolvedAt is a full timestamp (unlike the app's other
// @db.Date fields, which are already safe pre-formatted strings), so it's
// the one violation field that actually needs this conversion.
export function formatResolvedDate(iso: string | null): string {
  // Philippine calendar date regardless of the viewer's device time zone.
  return iso ? toPhDate(iso) : "";
}

// Same limit as the backend (VIOLATION_NOTICE_THRESHOLD in lib/violationPolicy.ts):
// from this many violations on record, the admin may send a consequence notice.
export const VIOLATION_LIMIT = 5;
