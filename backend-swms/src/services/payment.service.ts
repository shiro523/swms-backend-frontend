import { randomUUID } from "crypto";
import { paymentRepository } from "@/repositories/payment.repository";
import { householdRepository } from "@/repositories/household.repository";
import { mapPayment } from "@/utils/mappers";
import { relationScopedWhere, canAccessHousehold } from "@/utils/scope";
import { getDbToday } from "@/lib/dbTime";
import { HttpError } from "@/middlewares/error.middleware";
import type { AuthContext } from "@/lib/token";

interface CreatePaymentInput {
  householdId: string;
  period: string;
  amount: number;
  datePaid?: string;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// The single, authoritative definition of "the current billing period" —
// matches the exact "{Month} {Year}" format already used everywhere Payment.period
// is entered (e.g. "March 2026"). Server-authoritative (from the DB clock, not
// the caller's), matching every other date computed elsewhere in this app.
// Any page that needs to know which households are paid/unpaid for the
// current period should derive it from this, not invent its own definition.
function currentPeriodLabel(today: Date): string {
  return `${MONTH_NAMES[today.getUTCMonth()]} ${today.getUTCFullYear()}`;
}

export const paymentService = {
  async list(user: AuthContext, householdId?: string) {
    const rows = await paymentRepository.findMany(relationScopedWhere(user, householdId));
    return rows.map(mapPayment);
  },

  // Exposes the server's definition of "the current billing period" so the
  // frontend can determine paid/unpaid-for-this-period from real Payment
  // records (matching by period) instead of relying on the browser's clock
  // or the stored, non-period-aware Household.paymentStatus flag.
  async currentPeriod() {
    const today = await getDbToday();
    return { period: currentPeriodLabel(today) };
  },

  async create(user: AuthContext, input: CreatePaymentInput) {
    const household = await householdRepository.findRawById(input.householdId);
    if (!canAccessHousehold(user, household)) {
      throw new HttpError(404, "Household not found");
    }

    const datePaid = input.datePaid ? new Date(input.datePaid) : await getDbToday();
    const id = `pay-${randomUUID()}`;
    // No (householdId, period) uniqueness check: the real business rule is
    // weekly Sunday collections, and a household may legitimately make
    // more than one payment toward the same collection period (partial
    // payments, or several installments) — see the migration that dropped
    // that constraint. splitHouseholdsByCurrentPeriod only checks whether
    // at least one matching-period payment exists, so multiple rows for
    // the same period are handled correctly without any special-casing.
    await paymentRepository.createWithNotification(
      {
        id,
        householdId: input.householdId,
        period: input.period,
        amount: input.amount,
        status: "paid",
        datePaid,
      },
      { message: `Payment of ₱${input.amount.toFixed(2)} recorded for ${input.period}.`, nDate: datePaid },
    );
    await householdRepository.updatePaymentStatus(input.householdId, "paid");

    const row = await paymentRepository.findById(id);
    return mapPayment(row);
  },

  // Admin-only (enforced by requireRole("admin") at the route level) — the
  // narrow fix for a payment recorded with a malformed period (e.g.
  // "October" instead of "October 2026") that can never match the current
  // period again. Never creates a new row or touches amount/householdId/
  // datePaid — paymentRepository.updatePeriod's own signature makes that
  // structurally impossible, not just an unchecked convention here.
  async correctPeriod(id: string, period: string) {
    const existing = await paymentRepository.findById(id);
    if (!existing) {
      throw new HttpError(404, "Payment not found");
    }
    const row = await paymentRepository.updatePeriod(id, period);
    return mapPayment(row);
  },
};
