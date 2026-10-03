import { Router } from "express";
import { trashLogController } from "@/controllers/trashLog.controller";
import { authRequired, requireRole } from "@/middlewares/auth.middleware";
import { validateBody } from "@/middlewares/validate.middleware";
import { createTrashLogSchema } from "@/schema/trashLog.schema";

const router = Router();
router.use(authRequired);

// GET /api/trash-logs — scoped, optional ?householdId=
router.get("/", trashLogController.list);

// GET /api/trash-logs/:id — single record, scoped the same way as the list
// (admin: any; purok-leader: their purok; resident: their own household).
router.get("/:id", trashLogController.getById);

// POST /api/trash-logs — record a collection/violation from a QR scan
router.post(
  "/",
  requireRole("admin", "purok-leader"),
  validateBody(createTrashLogSchema),
  trashLogController.create,
);

export default router;
