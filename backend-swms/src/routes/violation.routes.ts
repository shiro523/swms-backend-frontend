import { Router } from "express";
import { violationController } from "@/controllers/violation.controller";
import { authRequired, requireRole } from "@/middlewares/auth.middleware";
import { validateBody } from "@/middlewares/validate.middleware";
import { consequenceNoticeSchema } from "@/schema/violation.schema";

const router = Router();
router.use(authRequired);

// GET /api/violations — scoped, optional ?householdId=
router.get("/", violationController.list);

// GET /api/violations/at-limit — households with 5+ violations on record
router.get("/at-limit", requireRole("admin", "purok-leader"), violationController.householdsAtLimit);

// POST /api/violations/consequence-notices — the admin notifies a household
// at the limit of the consequences (admin only).
router.post(
  "/consequence-notices",
  requireRole("admin"),
  validateBody(consequenceNoticeSchema),
  violationController.sendConsequenceNotice,
);

// PATCH /api/violations/:id/complete — mark a violation completed once the
// resident has complied. Purok leader only: the admin's role on violations
// is the consequence notice; residents are view-only.
router.patch("/:id/complete", requireRole("purok-leader"), violationController.complete);

export default router;
