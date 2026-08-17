import type { Request, Response } from "express";
import { purokService } from "@/services/purok.service";

export const purokController = {
  async list(req: Request, res: Response) {
    const rows = await purokService.list(req.user!);
    res.json(rows);
  },

  async create(req: Request, res: Response) {
    const purok = await purokService.create(req.body);
    res.status(201).json(purok);
  },

  async getAccounts(req: Request, res: Response) {
    const accounts = await purokService.getAccounts(String(req.params.id));
    res.json(accounts);
  },

  async update(req: Request, res: Response) {
    const purok = await purokService.update(String(req.params.id), req.body);
    res.json(purok);
  },
};
