// Shared date handling for full timestamps (removedAt, archivedAt,
// accountCreatedAt, resolvedAt). Calendar fields like registeredAt or a
// trash log's date are already plain "YYYY-MM-DD" strings and need none of
// this.

const PH_TIME_ZONE = "Asia/Manila";
const DAY_MS = 24 * 60 * 60 * 1000;

// Same window the server enforces for restoring a removed household or an
// archived purok (RESTORE_WINDOW_MS in household.service.ts / purok.service.ts).
export const RESTORE_WINDOW_DAYS = 30;

// The Philippine calendar date of a timestamp, as YYYY-MM-DD. Not
// iso.slice(0, 10): that is the UTC date, a day behind for anything that
// happened between midnight and 8 AM Philippine time.
export function toPhDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: PH_TIME_ZONE });
}

export function toPhDateOrDash(iso: string | null | undefined): string {
  return iso ? toPhDate(iso) : "—";
}

// The restore window for something removed/archived at `iso`, measured in
// exact milliseconds like the server (restorable while elapsed <= 30 days).
// Whole-day rounding let the Restore button show for up to a day after the
// server had already started refusing it.
export function restoreWindow(iso: string) {
  const deadline = new Date(new Date(iso).getTime() + RESTORE_WINDOW_DAYS * DAY_MS);
  const msLeft = deadline.getTime() - Date.now();
  return {
    canRestore: msLeft >= 0,
    // Rounded up: 2.5 days remaining reads "3 days left".
    daysLeft: Math.max(0, Math.ceil(msLeft / DAY_MS)),
    daysElapsed: Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / DAY_MS)),
    deadlineDate: toPhDate(deadline.toISOString()),
  };
}
