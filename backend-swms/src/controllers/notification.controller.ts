import type { Request, Response } from "express";
import { notificationService } from "@/services/notification.service";

export const notificationController = {
  async list(req: Request, res: Response) {
    res.json(await notificationService.list(req.user!));
  },

  async create(req: Request, res: Response) {
    const notification = await notificationService.create(req.body, Number(req.user!.id));
    res.status(201).json(notification);
  },

  async markRead(req: Request, res: Response) {
    const notification = await notificationService.markRead(req.user!, String(req.params.id));
    res.json(notification);
  },

  async unreadCount(req: Request, res: Response) {
    res.json(await notificationService.unreadCount(req.user!));
  },
};
