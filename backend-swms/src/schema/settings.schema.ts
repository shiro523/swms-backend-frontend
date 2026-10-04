import { z } from "zod";
import { contactNumberField } from "@/schema/household.schema";

// Same contact-number rule as households: digits only, at most 11.
export const updateSettingsSchema = z.object({
  barangayName: z.string().trim().min(1, "Barangay name is required.").max(120),
  municipality: z.string().trim().min(1, "Municipality is required.").max(120),
  contactNumber: z.string().trim().min(1, "Contact number is required.").pipe(contactNumberField),
  // Coerced from the form's string input, like complianceRate elsewhere in
  // this codebase. Two-decimal precision matches the column's Decimal(10,2).
  monthlyCollectionFee: z.coerce
    .number()
    .min(0, "Monthly collection fee cannot be negative.")
    .max(999999.99, "Monthly collection fee is too large.")
    .transform((n) => Math.round(n * 100) / 100),
  collectionDays: z.string().trim().min(1, "Collection days are required.").max(120),
  collectionTime: z.string().trim().min(1, "Collection time is required.").max(60),
});
