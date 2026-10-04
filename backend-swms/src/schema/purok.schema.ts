import { z } from "zod";

export const createPurokSchema = z.object({
  name: z.string().trim().min(1, "Purok name and leader name are required.").max(120),
  leaderName: z.string().trim().min(1, "Purok name and leader name are required.").max(120),
  // A purok-leader login account is created alongside the purok.
  username: z.string().trim().min(3, "Username, password, and email are required for the leader account."),
  password: z.string().min(8, "Password must be at least 8 characters."),
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
});

export const updatePurokSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    leaderName: z.string().trim().min(1).max(120).optional(),
    username: z.string().trim().min(3).optional(),
    email: z.string().trim().toLowerCase().email("Enter a valid email address.").optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: "Nothing to update." });
