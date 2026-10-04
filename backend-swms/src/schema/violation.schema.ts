import { z } from "zod";

export const consequenceNoticeSchema = z.object({
  householdId: z.string().trim().min(1, "A household is required."),
  message: z.string().trim().min(1, "A message is required.").max(1000),
});
