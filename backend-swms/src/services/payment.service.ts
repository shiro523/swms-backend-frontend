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
  orNumber?: string;
  datePaid?: string;
}

// OR numbers are recorded from a physical receipt, so trim stray whitespace
// and normalize case up front — otherwise "OR-1001" and "or-1001" would be
// treated as different numbers by both the duplicate check and storage.
function normalizeOrNumber(value?: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed.toUpperCase() : null;
}

export const paymentService = {
  async list(user: AuthContext, householdId?: string) {
    const rows = await paymentRepository.findMany(relationScopedWhere(user, householdId));
    return rows.map(mapPayment);
  },

  async create(user: AuthContext, input: CreatePaymentInput) {
    const household = await householdRepository.findRawById(input.householdId);
    if (!canAccessHousehold(user, household)) {
      throw new HttpError(404, "Household not found");
    }

    const orNumber = normalizeOrNumber(input.orNumber);
    if (orNumber && (await paymentRepository.findByOrNumber(orNumber))) {
      throw new HttpError(400, "That OR number is already recorded on another payment.");
    }

    const datePaid = input.datePaid ? new Date(input.datePaid) : await getDbToday();
    const id = `pay-${randomUUID()}`;
    try {
      await paymentRepository.create({
        id,
        householdId: input.householdId,
        period: input.period,
        amount: input.amount,
        status: "paid",
        datePaid,
        orNumber,
      });
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
};
