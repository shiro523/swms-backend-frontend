import { z } from "zod";

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// The single source of truth for what a valid billing period looks like —
// enforced here, at the one write path both Admin and Purok Leader share
// (POST /api/payments), so splitHouseholdsByCurrentPeriod's paid/unpaid
// comparison (frontend) can never be defeated by a malformed stored value.
// Case-insensitive on input (then normalized to the canonical capitalized
// form below) because the Period field is still free text and a leader
// typing "october 2026" is a reasonable thing to do — but a value missing
// the year entirely (e.g. "October"), or using an abbreviation ("Oct
// 2026"), is rejected outright rather than silently stored as something
// that can never match the current period again. This is exactly the real
// bug this closes: a payment recorded with period "October" (no year)
// never matched the canonical "October 2026", leaving a household that had
// genuinely just paid still showing as unpaid on both Admin and Purok
// Leader pages.
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const PERIOD_PATTERN = new RegExp(`^(${MONTH_NAMES.join("|")}) \\d{4}$`, "i");

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
  period: z
    .string()
    .trim()
    .min(1, "Period is required.")
    .max(40)
    .regex(PERIOD_PATTERN, 'Period must be in the format "Month YYYY", e.g. "October 2026".')
    .transform((value) => {
      const [month, year] = value.split(" ");
      const canonicalMonth = MONTH_NAMES.find((m) => m.toLowerCase() === month.toLowerCase())!;
      return `${canonicalMonth} ${year}`;
    }),
  amount: z.coerce.number().positive("Amount must be greater than zero."),
  datePaid: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || isValidCalendarDate(v), "Date paid must be a valid date in YYYY-MM-DD format."),
});
