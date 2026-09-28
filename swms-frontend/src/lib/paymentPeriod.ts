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
export function splitHouseholdsByCurrentPeriod(
  households: Household[],
  payments: Payment[],
  currentPeriod: string,
) {
  const paidHouseholdIds = new Set(
    payments.filter((p) => p.period === currentPeriod).map((p) => p.householdId),
  );
  return {
    paidHouseholdIds,
    paidHouseholds: households.filter((h) => paidHouseholdIds.has(h.id)),
    unpaidHouseholds: households.filter((h) => !paidHouseholdIds.has(h.id)),
  };
}
