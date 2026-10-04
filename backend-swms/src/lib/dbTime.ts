import { prisma } from "@/lib/prisma";

// Read "now" from Postgres rather than the Node process so log dates/times are
// consistent regardless of the app server's local clock/timezone.
//
// The database connection is deliberately left on its default session
// timezone (UTC) — NOW() there is an unambiguous absolute instant. Setting
// the session's TimeZone instead (tried and reverted) makes the `pg` driver
// misparse the resulting offset-annotated timestamptz text, shifting every
// NOW()/$queryRaw timestamp read 8 hours too far ahead — a correctness bug
// far worse than the one it was meant to fix. Converting to Philippines
// local time is done here instead, as fixed +8h arithmetic on that
// already-correct UTC instant (the Philippines has no DST, so the offset
// is always exactly 8 hours, no calendar edge cases to handle).
const PH_OFFSET_MS = 8 * 60 * 60 * 1000;

// Without this shift, CURRENT_DATE/NOW() reflect the UTC calendar day, which
// runs a full day behind Philippines local time for the 8 hours between
// midnight and 8 AM PHT — a trash log, violation, payment, or household
// registered in that window would be stored under the previous day, and the
// TrashLog (household_id, log_date) daily-duplicate check is keyed on that
// same wrong date.
// Exported only so the conversion math itself can be unit-tested against
// fixed instants (including the midnight-rollover edge case) without
// depending on real wall-clock timing or a database connection.
export function toPhilippinesCalendarDay(instant: Date): Date {
  const shifted = new Date(instant.getTime() + PH_OFFSET_MS);
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()));
}

export function toPhilippinesTime12h(instant: Date): string {
  const shifted = new Date(instant.getTime() + PH_OFFSET_MS);
  const hours24 = shifted.getUTCHours();
  const minutes = shifted.getUTCMinutes();
  const ampm = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 || 12;
  return `${String(hours12).padStart(2, "0")}:${String(minutes).padStart(2, "0")} ${ampm}`;
}

export async function getDbToday(): Promise<Date> {
  const now = await getDbNow();
  return toPhilippinesCalendarDay(now);
}

export async function getDbTodayAndTime(): Promise<{ today: Date; time: string }> {
  const now = await getDbNow();
  return { today: toPhilippinesCalendarDay(now), time: toPhilippinesTime12h(now) };
}

// Full timestamp (not just the calendar date) — used where sub-day precision
// matters, e.g. Purok archive/restore-window arithmetic (Batch D) and
// Household removal/restore (added later, same reasoning). This is a real
// absolute instant (UTC under the hood, like any JS Date) — never itself
// "wrong", only ever misread if something tries to format it without
// accounting for Philippines local time, which the two helpers above exist
// to do correctly.
//
// Still the DB's clock, but without a DB round trip on every call: the
// offset between the DB clock and this process's clock is measured once and
// re-measured every CLOCK_SYNC_INTERVAL_MS, then applied to the local clock.
// Accurate to within one network round trip (tens of ms), which nothing here
// depends on — callers use calendar days, minutes, or 30-day windows.
const CLOCK_SYNC_INTERVAL_MS = 10 * 60 * 1000;
let clockOffsetMs = 0;
let lastClockSyncAt = 0;
let pendingClockSync: Promise<void> | null = null;

async function syncClockOffset(): Promise<void> {
  const before = Date.now();
  const rows = await prisma.$queryRaw<{ now: Date }[]>`SELECT NOW() AS now`;
  const after = Date.now();
  clockOffsetMs = rows[0].now.getTime() - (before + after) / 2;
  lastClockSyncAt = after;
}

export async function getDbNow(): Promise<Date> {
  if (Date.now() - lastClockSyncAt > CLOCK_SYNC_INTERVAL_MS) {
    pendingClockSync ??= syncClockOffset().finally(() => {
      pendingClockSync = null;
    });
    await pendingClockSync;
  }
  return new Date(Date.now() + clockOffsetMs);
}
