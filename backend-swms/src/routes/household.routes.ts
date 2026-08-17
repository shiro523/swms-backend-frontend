import { Router } from "express";
import { householdController } from "@/controllers/household.controller";
import { authRequired, requireRole } from "@/middlewares/auth.middleware";
import { validateBody } from "@/middlewares/validate.middleware";
import { createHouseholdSchema, updateHouseholdSchema, addFamilyMemberSchema } from "@/schema/household.schema";

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

export default router;
