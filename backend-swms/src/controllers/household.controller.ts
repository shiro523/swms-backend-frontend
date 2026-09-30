import type { Request, Response } from "express";
import { householdService } from "@/services/household.service";

export const householdController = {
  async list(req: Request, res: Response) {
    const includeRemoved = req.query.removed === "true";
    res.json(await householdService.list(req.user!, includeRemoved));
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

  async updateMember(req: Request, res: Response) {
    const member = await householdService.updateMember(
      req.user!,
      String(req.params.id),
      String(req.params.memberId),
      req.body,
    );
    res.json(member);
  },

  async removeMember(req: Request, res: Response) {
    await householdService.removeMember(req.user!, String(req.params.id), String(req.params.memberId));
    res.status(204).send();
  },

  async remove(req: Request, res: Response) {
    const household = await householdService.remove(req.user!, String(req.params.id), req.body.reason);
    res.json(household);
  },

  async restore(req: Request, res: Response) {
    const household = await householdService.restore(String(req.params.id));
    res.json(household);
  },

  async permanentlyDelete(req: Request, res: Response) {
    await householdService.permanentlyDelete(String(req.params.id));
    res.status(204).send();
  },
};
