import { Router } from "express";
import { statsController } from "@/controllers/stats.controller";
import { authRequired } from "@/middlewares/auth.middleware";

const router = Router();
router.use(authRequired);

// GET /api/stats/monthly-collection — compliant/violation/missed per month
router.get("/monthly-collection", statsController.monthlyCollection);

// GET /api/stats/payment-collection — collected vs target per month
router.get("/payment-collection", statsController.paymentCollection);

export default router;
