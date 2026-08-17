import { Router } from "express";
import authRoutes from "@/routes/auth.routes";
import purokRoutes from "@/routes/purok.routes";
import householdRoutes from "@/routes/household.routes";
import trashLogRoutes from "@/routes/trashLog.routes";
import paymentRoutes from "@/routes/payment.routes";
import violationRoutes from "@/routes/violation.routes";
import notificationRoutes from "@/routes/notification.routes";
import statsRoutes from "@/routes/stats.routes";

const router = Router();

router.use("/auth", authRoutes);
router.use("/puroks", purokRoutes);
router.use("/households", householdRoutes);
router.use("/trash-logs", trashLogRoutes);
router.use("/payments", paymentRoutes);
router.use("/violations", violationRoutes);
router.use("/notifications", notificationRoutes);
router.use("/stats", statsRoutes);

export default router;
