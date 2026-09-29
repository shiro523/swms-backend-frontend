import { Router } from "express";
import { settingsController } from "@/controllers/settings.controller";
import { authRequired, requireRole } from "@/middlewares/auth.middleware";
import { validateBody } from "@/middlewares/validate.middleware";
import { updateSettingsSchema } from "@/schema/settings.schema";

const router = Router();
router.use(authRequired);

// GET /api/settings — admin-only system-wide configuration (Batch F).
router.get("/", requireRole("admin"), settingsController.get);

// PATCH /api/settings — admin-only update of the same singleton record.
router.patch("/", requireRole("admin"), validateBody(updateSettingsSchema), settingsController.update);

export default router;
