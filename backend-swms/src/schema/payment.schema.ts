import { z } from "zod";

export const createPaymentSchema = z.object({
  householdId: z.string().trim().min(1, "Household is required."),
  period: z.string().trim().min(1, "Period is required."),
  amount: z.coerce.number().positive("Amount must be greater than zero."),
  orNumber: z.string().trim().optional(),
  datePaid: z.string().trim().optional(),
});
