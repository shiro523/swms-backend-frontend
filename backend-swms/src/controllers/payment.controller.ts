import type { Request, Response } from "express";
import { paymentService } from "@/services/payment.service";

export const paymentController = {
  async list(req: Request, res: Response) {
    const householdId = typeof req.query.householdId === "string" ? req.query.householdId : undefined;
    res.json(await paymentService.list(req.user!, householdId));
  },

  async create(req: Request, res: Response) {
    const payment = await paymentService.create(req.user!, req.body);
    res.status(201).json(payment);
  },

  async currentPeriod(_req: Request, res: Response) {
    res.json(await paymentService.currentPeriod());
  },

  async correctPeriod(req: Request, res: Response) {
    const payment = await paymentService.correctPeriod(String(req.params.id), req.body.period);
    res.json(payment);
  },
};
