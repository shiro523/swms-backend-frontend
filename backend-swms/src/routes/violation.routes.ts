import { Router } from "express";
import { violationController } from "@/controllers/violation.controller";
import { authRequired, requireRole } from "@/middlewares/auth.middleware";

const router = Router();
router.use(authRequired);

// GET /api/violations — scoped, optional ?householdId=
router.get("/", violationController.list);

// PATCH /api/violations/:id/complete — mark a violation completed (admin or
// purok-leader only; residents are strictly view-only, Batch H).
router.patch("/:id/complete", requireRole("admin", "purok-leader"), violationController.complete);

export default router;
