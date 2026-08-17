import { Router } from "express";
import { paymentController } from "@/controllers/payment.controller";
import { authRequired } from "@/middlewares/auth.middleware";

const router = Router();
router.use(authRequired);

// GET /api/payments — scoped, optional ?householdId=
router.get("/", paymentController.list);

export default router;
