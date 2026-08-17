import { z } from "zod";

const memberInput = z.object({
  name: z.string().trim().min(1),
  relation: z.string().trim().optional(),
  age: z.coerce.number().int(),
});

export const createHouseholdSchema = z.object({
  representative: z.string().trim().min(1, "Representative, address, contact number, and purok are required."),
  address: z.string().trim().min(1, "Representative, address, contact number, and purok are required."),
  contactNumber: z.string().trim().min(1, "Representative, address, contact number, and purok are required."),
  purokId: z.string().trim().optional(),
  members: z.array(memberInput).optional().default([]),
  // A resident login account is created alongside the household.
  username: z.string().trim().min(3, "Username, password, and email are required for the resident account."),
  password: z.string().min(8, "Password must be at least 8 characters."),
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
});

export const updateHouseholdSchema = z
  .object({
    representative: z.string().trim().min(1).optional(),
    contactNumber: z.string().trim().min(1).optional(),
    address: z.string().trim().min(1).optional(),
    username: z.string().trim().min(3).optional(),
    email: z.string().trim().toLowerCase().email("Enter a valid email address.").optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: "Nothing to update." });

export const addFamilyMemberSchema = z.object({
  name: z.string().trim().min(1, "Name and a valid age are required."),
  relation: z.string().trim().optional(),
  age: z.coerce.number().int({ message: "Name and a valid age are required." }),
});
