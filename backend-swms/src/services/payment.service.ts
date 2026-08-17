import { paymentRepository } from "@/repositories/payment.repository";
import { mapPayment } from "@/utils/mappers";
import { relationScopedWhere } from "@/utils/scope";
import type { AuthContext } from "@/lib/token";

export const paymentService = {
  async list(user: AuthContext, householdId?: string) {
    const rows = await paymentRepository.findMany(relationScopedWhere(user, householdId));
    return rows.map(mapPayment);
  },
};
