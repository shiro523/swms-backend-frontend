import { Router } from "express";
import { householdController } from "@/controllers/household.controller";
import { authRequired, requireRole } from "@/middlewares/auth.middleware";
import { validateBody } from "@/middlewares/validate.middleware";
import {
  createHouseholdSchema,
  updateHouseholdSchema,
  addFamilyMemberSchema,
  updateFamilyMemberSchema,
  removeHouseholdSchema,
} from "@/schema/household.schema";

const router = Router();
router.use(authRequired);

// GET /api/households — scoped list
router.get("/", householdController.list);

// POST /api/households — register a household + resident account (purok-leader only)
router.post(
  "/",
  requireRole("purok-leader"),
  validateBody(createHouseholdSchema),
  householdController.create,
);

// GET /api/households/:id — single household (access-checked)
router.get("/:id", householdController.getById);

// PATCH /api/households/:id — update contact details (own household / in scope)
router.patch("/:id", validateBody(updateHouseholdSchema), householdController.update);

// POST /api/households/:id/members — add a family member
router.post("/:id/members", validateBody(addFamilyMemberSchema), householdController.addMember);

// PATCH /api/households/:id/members/:memberId — edit a family member (own
// household / in scope — same access rule as adding one)
router.patch(
  "/:id/members/:memberId",
  validateBody(updateFamilyMemberSchema),
  householdController.updateMember,
);

// DELETE /api/households/:id/members/:memberId — remove a family member
// (own household / in scope). Never touches the household, its resident
// account, or any other family member.
router.delete("/:id/members/:memberId", householdController.removeMember);

// POST /api/households/:id/remove — soft-remove (own purok for a leader, any for admin)
router.post(
  "/:id/remove",
  requireRole("admin", "purok-leader"),
  validateBody(removeHouseholdSchema),
  householdController.remove,
);

// POST /api/households/:id/restore — admin-only reversal of a removal
router.post("/:id/restore", requireRole("admin"), householdController.restore);

// DELETE /api/households/:id — permanently delete an already-removed
// household (admin only). Cascades its dependent records; never reachable
// for an active household.
router.delete("/:id", requireRole("admin"), householdController.permanentlyDelete);

export default router;
