import type { Household } from "./types";

// The purok leader's list of households without a payment this period.
export const UNPAID_LIST_ANCHOR = "unpaid";
export const UNPAID_LIST_HREF = `/purok-leader/payments#${UNPAID_LIST_ANCHOR}`;

// Households with no payment for the current period — "unpaid" first, then
// "new" (registered this month). Uses the server's periodPaymentStatus.
export function householdsAwaitingPayment(households: Household[]): Household[] {
  return households
    .filter((h) => h.periodPaymentStatus !== "paid")
    .sort((a, b) => Number(a.periodPaymentStatus === "new") - Number(b.periodPaymentStatus === "new"));
}

// A household's compliance rate is only a placeholder (100) until its first
// trash log, so show it as "no records" instead of a made-up 100%.
export function complianceLabel(h: Household): string {
  return h.hasCollectionRecords ? `${h.complianceRate}%` : "—";
}

// Spreadsheet/CSV value: the number when real, otherwise a readable label.
export function complianceExportValue(h: Household): number | string {
  return h.hasCollectionRecords ? h.complianceRate : "No records";
}
