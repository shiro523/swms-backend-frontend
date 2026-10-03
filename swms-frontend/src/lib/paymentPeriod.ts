import type { Household, Payment } from "./types";

// Single shared definition of "paid for the current billing period," reused
// by every page that needs to know which households have/haven't paid this
// period. Always derive it this way — never from Payment.status (every
// Payment row is created with status "paid", so it carries no period
// information) and never from Household.paymentStatus (a stored flag that
// only ever means "has this household paid at least once, ever" and never
// reverts when a new period starts without a payment).
//
// currentPeriod should come from api.currentPaymentPeriod() — the server's
// one authoritative definition — never recomputed from the browser's clock.
// Case-insensitive on purpose: the Period field on RecordPaymentDialog is
// free text (e.g. "October 2026"), so a leader typing "october 2026" for
// this same period must still count as paid for it — a plain === match
// would otherwise leave that household showing as unpaid despite having
// just paid. Never changes what's actually stored; only loosens the
// comparison used to decide paid/unpaid.
function normalizePeriod(period: string): string {
  return period.trim().toLowerCase();
}

const MONTH_NAMES = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

// Chronological position of a "Month YYYY" period, or null when it isn't in
// that shape (e.g. a legacy "October" with no year) — never throws.
function periodSortKey(period: string): number | null {
  const match = period.trim().match(/^([A-Za-z]+)\s+(\d{4})$/);
  if (!match) return null;
  const month = MONTH_NAMES.indexOf(match[1].toLowerCase());
  if (month === -1) return null;
  return Number(match[2]) * 12 + month;
}

// Distinct periods, newest first. Well-formed "Month YYYY" periods are
// ordered by real date (across years); anything unparseable goes last,
// alphabetically, so a legacy/malformed value can't break or reorder the
// rest of the list.
export function sortPeriodsNewestFirst(periods: Iterable<string>): string[] {
  return Array.from(new Set(periods)).sort((a, b) => {
    const keyA = periodSortKey(a);
    const keyB = periodSortKey(b);
    if (keyA !== null && keyB !== null) return keyB - keyA;
    if (keyA !== null) return -1;
    if (keyB !== null) return 1;
    return a.localeCompare(b);
  });
}

export function splitHouseholdsByCurrentPeriod(
  households: Household[],
  payments: Payment[],
  currentPeriod: string,
) {
  const normalizedCurrentPeriod = normalizePeriod(currentPeriod);
  const paidHouseholdIds = new Set(
    payments.filter((p) => normalizePeriod(p.period) === normalizedCurrentPeriod).map((p) => p.householdId),
  );
  return {
    paidHouseholdIds,
    paidHouseholds: households.filter((h) => paidHouseholdIds.has(h.id)),
    unpaidHouseholds: households.filter((h) => !paidHouseholdIds.has(h.id)),
  };
}
