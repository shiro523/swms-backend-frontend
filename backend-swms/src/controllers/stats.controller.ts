import type { Request, Response } from "express";
import { statsService } from "@/services/stats.service";

export const statsController = {
  async monthlyCollection(_req: Request, res: Response) {
    res.json(await statsService.monthlyCollection());
  },

  async paymentCollection(_req: Request, res: Response) {
    res.json(await statsService.paymentCollection());
  },
};
