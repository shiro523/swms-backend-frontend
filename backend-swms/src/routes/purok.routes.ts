import { Router } from "express";
import { purokController } from "@/controllers/purok.controller";
import { authRequired, requireRole } from "@/middlewares/auth.middleware";
import { validateBody } from "@/middlewares/validate.middleware";
import { createPurokSchema, updatePurokSchema } from "@/schema/purok.schema";

const router = Router();
router.use(authRequired);

// GET /api/puroks — admin sees all, purok-leader sees their own, residents forbidden.
router.get("/", requireRole("admin", "purok-leader"), purokController.list);

// POST /api/puroks — create a purok (admin only)
router.post("/", requireRole("admin"), validateBody(createPurokSchema), purokController.create);

// PATCH /api/puroks/:id — edit a purok's name/leader name/leader account (admin only)
router.patch("/:id", requireRole("admin"), validateBody(updatePurokSchema), purokController.update);

// GET /api/puroks/:id/accounts — the leader + resident accounts under this purok (admin only)
router.get("/:id/accounts", requireRole("admin"), purokController.getAccounts);

export default router;
