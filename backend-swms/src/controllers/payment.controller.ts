import type { Request, Response } from "express";
import { paymentService } from "@/services/payment.service";

export const paymentController = {
  async list(req: Request, res: Response) {
    const householdId = typeof req.query.householdId === "string" ? req.query.householdId : undefined;
    res.json(await paymentService.list(req.user!, householdId));
  },
};
