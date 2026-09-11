import { Router } from "express";
import { paymentController } from "@/controllers/payment.controller";
import { authRequired, requireRole } from "@/middlewares/auth.middleware";
import { validateBody } from "@/middlewares/validate.middleware";
import { createPaymentSchema } from "@/schema/payment.schema";

const router = Router();
router.use(authRequired);

// GET /api/payments — scoped, optional ?householdId=
router.get("/", paymentController.list);

// POST /api/payments — record a payment (admin only)
router.post("/", requireRole("admin"), validateBody(createPaymentSchema), paymentController.create);

export default router;
