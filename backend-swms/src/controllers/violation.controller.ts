import type { Request, Response } from "express";
import { violationService } from "@/services/violation.service";

export const violationController = {
  async list(req: Request, res: Response) {
    const householdId = typeof req.query.householdId === "string" ? req.query.householdId : undefined;
    res.json(await violationService.list(req.user!, householdId));
  },
};
