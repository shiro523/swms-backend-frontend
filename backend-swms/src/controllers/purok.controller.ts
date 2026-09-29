import type { Request, Response } from "express";
import { purokService } from "@/services/purok.service";

export const purokController = {
  async list(req: Request, res: Response) {
    const includeArchived = req.query.archived === "true";
    const rows = await purokService.list(req.user!, includeArchived);
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

  async archive(req: Request, res: Response) {
    const purok = await purokService.archive(String(req.params.id));
    res.json(purok);
  },

  async restore(req: Request, res: Response) {
    const purok = await purokService.restore(String(req.params.id));
    res.json(purok);
  },

  async permanentlyDelete(req: Request, res: Response) {
    await purokService.permanentlyDelete(String(req.params.id));
    res.status(204).send();
  },
};
