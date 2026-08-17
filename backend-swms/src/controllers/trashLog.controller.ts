import type { Request, Response } from "express";
import { trashLogService } from "@/services/trashLog.service";

export const trashLogController = {
  async list(req: Request, res: Response) {
    const householdId = typeof req.query.householdId === "string" ? req.query.householdId : undefined;
    res.json(await trashLogService.list(req.user!, householdId));
  },

  async create(req: Request, res: Response) {
    const log = await trashLogService.create(req.user!, req.body);
    res.status(201).json(log);
  },
};
