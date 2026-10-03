import { Router } from "express";
import { statsController } from "@/controllers/stats.controller";
import { authRequired, requireRole } from "@/middlewares/auth.middleware";

const router = Router();

// GET /api/stats/public — barangay totals for the login page. Registered
// BEFORE authRequired: it is read while signed out, and returns aggregate
// counts only (households, puroks, average compliance).
router.get("/public", statsController.publicSummary);

router.use(authRequired);

// GET /api/stats/monthly-collection — compliant/violation/missed per month
router.get("/monthly-collection", statsController.monthlyCollection);

// GET /api/stats/payment-collection — collected vs target per month
router.get("/payment-collection", statsController.paymentCollection);

// GET /api/stats/admin-dashboard — every figure on the admin dashboard in one call
router.get("/admin-dashboard", requireRole("admin"), statsController.adminDashboard);

export default router;
