import { z } from "zod";

// Digits only, at most 11 (a PH mobile number, 09XXXXXXXXX, is 11 digits).
// Kept as text rather than an integer: a number type would drop the
// leading 0. Shared with settings.schema.ts (the barangay's contact number).
export const CONTACT_NUMBER_MAX_DIGITS = 11;
export const contactNumberField = z
  .string()
  .trim()
  .regex(
    new RegExp(`^\\d{1,${CONTACT_NUMBER_MAX_DIGITS}}$`),
    `Contact number must contain digits only (maximum ${CONTACT_NUMBER_MAX_DIGITS}).`,
  );

const memberInput = z.object({
  name: z.string().trim().min(1).max(120),
  relation: z.string().trim().max(60).optional(),
  age: z.coerce.number().int().min(0, "Age must be between 0 and 120.").max(120, "Age must be between 0 and 120."),
});

export const createHouseholdSchema = z.object({
  representative: z.string().trim().min(1, "Representative, address, contact number, and purok are required.").max(120),
  address: z.string().trim().min(1, "Representative, address, contact number, and purok are required.").max(150),
  contactNumber: z
    .string()
    .trim()
    .min(1, "Representative, address, contact number, and purok are required.")
    .pipe(contactNumberField),
  purokId: z.string().trim().optional(),
  members: z.array(memberInput).optional().default([]),
  // A resident login account is created alongside the household.
  username: z.string().trim().min(3, "Username, password, and email are required for the resident account."),
  password: z.string().min(8, "Password must be at least 8 characters."),
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
});

export const updateHouseholdSchema = z
  .object({
    representative: z.string().trim().min(1).max(120).optional(),
    contactNumber: contactNumberField.optional(),
    address: z.string().trim().min(1).max(150).optional(),
    username: z.string().trim().min(3).optional(),
    email: z.string().trim().toLowerCase().email("Enter a valid email address.").optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: "Nothing to update." });

export const removeHouseholdSchema = z.object({
  reason: z.string().trim().min(1, "A removal reason is required.").max(300),
});

export const addFamilyMemberSchema = z.object({
  name: z.string().trim().min(1, "Name and a valid age are required.").max(120),
  relation: z.string().trim().max(60).optional(),
  age: z.coerce
    .number()
    .int({ message: "Name and a valid age are required." })
    .min(0, "Age must be between 0 and 120.")
    .max(120, "Age must be between 0 and 120."),
});

export const updateFamilyMemberSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    relation: z.string().trim().max(60).optional(),
    age: z.coerce
      .number()
      .int()
      .min(0, "Age must be between 0 and 120.")
      .max(120, "Age must be between 0 and 120.")
      .optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: "Nothing to update." });
