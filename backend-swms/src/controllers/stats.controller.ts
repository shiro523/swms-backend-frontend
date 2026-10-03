import type { Request, Response } from "express";
import { statsService } from "@/services/stats.service";

export const statsController = {
  async monthlyCollection(req: Request, res: Response) {
    res.json(await statsService.monthlyCollection(req.user!));
  },

  async paymentCollection(req: Request, res: Response) {
    res.json(await statsService.paymentCollection(req.user!));
  },
};
