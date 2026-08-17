import { Router } from "express";
import { violationController } from "@/controllers/violation.controller";
import { authRequired } from "@/middlewares/auth.middleware";

const router = Router();
router.use(authRequired);

// GET /api/violations — scoped, optional ?householdId=
router.get("/", violationController.list);

export default router;
