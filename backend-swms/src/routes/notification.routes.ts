import { Router } from "express";
import { notificationController } from "@/controllers/notification.controller";
import { authRequired, requireRole } from "@/middlewares/auth.middleware";
import { validateBody } from "@/middlewares/validate.middleware";
import { createNotificationSchema } from "@/schema/notification.schema";

const router = Router();
router.use(authRequired);

// GET /api/notifications — shared barangay-wide announcements
router.get("/", notificationController.list);

// POST /api/notifications — broadcast a notification (admin only)
router.post("/", requireRole("admin"), validateBody(createNotificationSchema), notificationController.create);

export default router;
