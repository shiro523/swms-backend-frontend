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
  orNumber?: string;
  datePaid?: string;
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

    const datePaid = input.datePaid ? new Date(input.datePaid) : await getDbToday();
    const id = `pay-${randomUUID()}`;
    await paymentRepository.create({
      id,
      householdId: input.householdId,
      period: input.period,
      amount: input.amount,
      status: "paid",
      datePaid,
      orNumber: input.orNumber || null,
    });
    await householdRepository.updatePaymentStatus(input.householdId, "paid");

    const row = await paymentRepository.findById(id);
    return mapPayment(row);
  },
};
