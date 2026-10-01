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
