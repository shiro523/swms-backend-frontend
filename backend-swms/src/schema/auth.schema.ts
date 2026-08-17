import { z } from "zod";

export const loginSchema = z.object({
  username: z.string().trim().min(1, "Username and password are required."),
  password: z.string().min(1, "Username and password are required."),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
});

export const resetPasswordSchema = z.object({
  token: z.string().trim().min(1, "Reset token is required."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});
