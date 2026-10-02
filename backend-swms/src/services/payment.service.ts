import { randomUUID } from "crypto";
import { paymentRepository } from "@/repositories/payment.repository";
import { householdRepository } from "@/repositories/household.repository";
import { mapPayment } from "@/utils/mappers";
import { relationScopedWhere, canAccessHousehold } from "@/utils/scope";
import { getDbToday } from "@/lib/dbTime";
import { HttpError, isUniqueConflict } from "@/middlewares/error.middleware";
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
    try {
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
    } catch (err) {
      // Inert until the household+period unique constraint is approved and
      // migrated (see C4); wired up now so it takes effect the moment that
      // constraint exists, with no further code changes.
      if (isUniqueConflict(err, "payments_household_id_period_key")) {
        throw new HttpError(409, "This household already has a payment record for this period.");
      }
      throw err;
    }
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
    try {
      const row = await paymentRepository.updatePeriod(id, period);
      return mapPayment(row);
    } catch (err) {
      if (isUniqueConflict(err, "payments_household_id_period_key")) {
        throw new HttpError(409, "This household already has a payment record for that period.");
      }
      throw err;
    }
  },
};
