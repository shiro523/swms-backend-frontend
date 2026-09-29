import { z } from "zod";

export const createTrashLogSchema = z.object({
  householdId: z.string().trim().min(1, "Invalid status."),
  status: z.enum(["compliant", "violation", "missed"], { message: "Invalid status." }),
  disposedBy: z.enum(["owner", "representative"]).optional().default("representative"),
  notes: z.string().trim().max(1000).optional(),
});
