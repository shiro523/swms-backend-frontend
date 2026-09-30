import { z } from "zod";

export const createNotificationSchema = z
  .object({
    type: z.enum(["collection", "payment", "violation"], { message: "A type and message are required." }),
    message: z.string().trim().min(1, "A type and message are required.").max(1000),
    title: z.string().trim().max(150).optional(),
    targetPurokId: z.string().trim().optional(),
    targetHouseholdId: z.string().trim().optional(),
  })
  .refine((data) => !(data.targetPurokId && data.targetHouseholdId), {
    message: "Choose either a specific purok or a specific household, not both.",
  });
