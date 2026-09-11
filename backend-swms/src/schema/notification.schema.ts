import { z } from "zod";

export const createNotificationSchema = z.object({
  type: z.enum(["collection", "payment", "violation"], { message: "A type and message are required." }),
  message: z.string().trim().min(1, "A type and message are required."),
  title: z.string().trim().optional(),
  targetPurokId: z.string().trim().optional(),
});
