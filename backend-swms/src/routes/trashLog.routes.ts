import { Router } from "express";
import { trashLogController } from "@/controllers/trashLog.controller";
import { authRequired, requireRole } from "@/middlewares/auth.middleware";
import { validateBody } from "@/middlewares/validate.middleware";
import { createTrashLogSchema } from "@/schema/trashLog.schema";

const router = Router();
router.use(authRequired);

// GET /api/trash-logs — scoped, optional ?householdId=
router.get("/", trashLogController.list);

// POST /api/trash-logs — record a collection/violation from a QR scan
router.post(
  "/",
  requireRole("admin", "purok-leader"),
  validateBody(createTrashLogSchema),
  trashLogController.create,
);

export default router;
