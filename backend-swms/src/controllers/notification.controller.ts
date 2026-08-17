import type { Request, Response } from "express";
import { notificationService } from "@/services/notification.service";

export const notificationController = {
  async list(_req: Request, res: Response) {
    res.json(await notificationService.list());
  },

  async create(req: Request, res: Response) {
    const notification = await notificationService.create(req.body);
    res.status(201).json(notification);
  },
};
