import type { Request, Response } from "express";
import { householdService } from "@/services/household.service";

export const householdController = {
  async list(req: Request, res: Response) {
    res.json(await householdService.list(req.user!));
  },

  async create(req: Request, res: Response) {
    const household = await householdService.create(req.user!, req.body);
    res.status(201).json(household);
  },

  async getById(req: Request, res: Response) {
    res.json(await householdService.getById(req.user!, String(req.params.id)));
  },

  async update(req: Request, res: Response) {
    res.json(await householdService.update(req.user!, String(req.params.id), req.body));
  },

  async addMember(req: Request, res: Response) {
    const member = await householdService.addMember(req.user!, String(req.params.id), req.body);
    res.status(201).json(member);
  },
};
