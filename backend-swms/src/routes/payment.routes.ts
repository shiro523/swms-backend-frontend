import { Router } from "express";
import { paymentController } from "@/controllers/payment.controller";
import { authRequired, requireRole } from "@/middlewares/auth.middleware";
import { validateBody } from "@/middlewares/validate.middleware";
import { createPaymentSchema } from "@/schema/payment.schema";

const router = Router();
router.use(authRequired);

// GET /api/payments — scoped, optional ?householdId=
router.get("/", paymentController.list);

// GET /api/payments/current-period — the server's authoritative "current
// billing period" label (e.g. "September 2026"), for matching against
// Payment.period client-side. No data leak: any authenticated role can see
// what the current period is, same as anyone can see the current date.
router.get("/current-period", paymentController.currentPeriod);

// POST /api/payments — record a payment (admin, or a purok-leader for a
// household in their own purok — enforced by canAccessHousehold in the
// service, same pattern as trash-log creation).
router.post("/", requireRole("admin", "purok-leader"), validateBody(createPaymentSchema), paymentController.create);

export default router;
