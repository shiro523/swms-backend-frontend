import { z } from "zod";

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// The frontend sends this from an <input type="date">, which the browser
// already constrains to real calendar dates in YYYY-MM-DD — this re-checks
// the same thing server-side so a malformed value (e.g. a raw API call)
// can't reach `new Date(...)` and silently become an unrelated date, or an
// Invalid Date that fails deep inside Prisma as a 500.
function isValidCalendarDate(value: string): boolean {
  if (!DATE_ONLY_PATTERN.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day;
}

export const createPaymentSchema = z.object({
  householdId: z.string().trim().min(1, "Household is required."),
  period: z.string().trim().min(1, "Period is required."),
  amount: z.coerce.number().positive("Amount must be greater than zero."),
  orNumber: z.string().trim().optional(),
  datePaid: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || isValidCalendarDate(v), "Date paid must be a valid date in YYYY-MM-DD format."),
});
