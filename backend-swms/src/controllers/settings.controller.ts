import type { Request, Response } from "express";
import { settingsService } from "@/services/settings.service";

export const settingsController = {
  async get(req: Request, res: Response) {
    res.json(await settingsService.get());
  },

  async update(req: Request, res: Response) {
    res.json(await settingsService.update(req.body));
  },
};
