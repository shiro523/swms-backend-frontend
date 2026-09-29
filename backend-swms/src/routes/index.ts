import { Router } from "express";
import authRoutes from "@/routes/auth.routes";
import purokRoutes from "@/routes/purok.routes";
import householdRoutes from "@/routes/household.routes";
import trashLogRoutes from "@/routes/trashLog.routes";
import paymentRoutes from "@/routes/payment.routes";
import violationRoutes from "@/routes/violation.routes";
import notificationRoutes from "@/routes/notification.routes";
import statsRoutes from "@/routes/stats.routes";
import settingsRoutes from "@/routes/settings.routes";

const router = Router();

// GET /api/health — lightweight, unauthenticated liveness check for
// deployment platforms. No DB query: a slow/unreachable database shouldn't
// make an otherwise-running process look unhealthy.
router.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

router.use("/auth", authRoutes);
router.use("/puroks", purokRoutes);
router.use("/households", householdRoutes);
router.use("/trash-logs", trashLogRoutes);
router.use("/payments", paymentRoutes);
router.use("/violations", violationRoutes);
router.use("/notifications", notificationRoutes);
router.use("/stats", statsRoutes);
router.use("/settings", settingsRoutes);

export default router;
