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

// --- Year / month filtering --------------------------------------------
// Periods are "Month YYYY", so a year of records has at most 12 of them.
// Instead of one ever-growing period list, pages filter by year, then month.

export const MONTH_LABELS = MONTH_NAMES.map((m) => m[0].toUpperCase() + m.slice(1));

// Filter values: "all", a year ("2026"), or UNRECOGNIZED_YEAR for legacy
// periods with no year (e.g. "October") — kept visible so they can be found
// and fixed with "Correct period" rather than silently disappearing.
export const ALL = "all";
export const UNRECOGNIZED_YEAR = "other";

// Same period, compared the way splitHouseholdsByCurrentPeriod does
// (trimmed, case-insensitive).
export function isSamePeriod(a: string, b: string): boolean {
  return normalizePeriod(a) === normalizePeriod(b);
}

export function parsePeriod(period: string): { year: number; month: number } | null {
  const key = periodSortKey(period);
  return key === null ? null : { year: Math.floor(key / 12), month: key % 12 };
}

// Years that have payments, newest first, always including the current
// period's year; plus UNRECOGNIZED_YEAR when any period has no valid year.
export function periodYearOptions(periods: Iterable<string>, currentPeriod: string): string[] {
  const years = new Set<number>();
  let hasUnrecognized = false;
  const current = parsePeriod(currentPeriod);
  if (current) years.add(current.year);
  for (const period of periods) {
    const parsed = parsePeriod(period);
    if (parsed) years.add(parsed.year);
    else hasUnrecognized = true;
  }
  const options = Array.from(years).sort((a, b) => b - a).map(String);
  return hasUnrecognized ? [...options, UNRECOGNIZED_YEAR] : options;
}

// `month` is "all" or a 0-based month index as a string ("0" = January).
export function matchesYearMonth(period: string, year: string, month: string): boolean {
  if (year === ALL) {
    if (month === ALL) return true;
    return parsePeriod(period)?.month === Number(month);
  }
  const parsed = parsePeriod(period);
  if (year === UNRECOGNIZED_YEAR) return parsed === null;
  if (!parsed || parsed.year !== Number(year)) return false;
  return month === ALL || parsed.month === Number(month);
}

// Human label for a year/month filter selection, e.g. "November 2026",
// "2026", "November (all years)", "All years".
export function describeYearMonth(year: string, month: string): string {
  if (year === UNRECOGNIZED_YEAR) return "Payments without a year";
  const monthLabel = month === ALL ? null : MONTH_LABELS[Number(month)];
  if (year === ALL) return monthLabel ? `${monthLabel} (all years)` : "All years";
  return monthLabel ? `${monthLabel} ${year}` : year;
}

// File-name-safe version of a label: "November 2026" -> "november-2026".
export function toFileSlug(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
