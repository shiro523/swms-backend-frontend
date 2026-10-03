import { Router } from "express";
import { notificationController } from "@/controllers/notification.controller";
import { authRequired, requireRole } from "@/middlewares/auth.middleware";
import { validateBody } from "@/middlewares/validate.middleware";
import { createNotificationSchema } from "@/schema/notification.schema";

const router = Router();
router.use(authRequired);

// GET /api/notifications — shared barangay-wide announcements
router.get("/", notificationController.list);

// GET /api/notifications/unread-count — the current user's own unread count,
// server-authoritative (Batch E). Registered before any /:id route.
router.get("/unread-count", notificationController.unreadCount);

// POST /api/notifications — broadcast a notification (admin only)
router.post("/", requireRole("admin"), validateBody(createNotificationSchema), notificationController.create);

// PATCH /api/notifications/:id/read — mark read for the current user only (only if visible to the caller)
router.patch("/:id/read", notificationController.markRead);

// DELETE /api/notifications/:id — permanently retract a notification for
// everyone (admin only). Cascades its NotificationRead rows automatically.
router.delete("/:id", requireRole("admin"), notificationController.remove);

export default router;
