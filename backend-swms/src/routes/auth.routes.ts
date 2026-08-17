import { Router } from "express";
import { authController } from "@/controllers/auth.controller";
import { validateBody } from "@/middlewares/validate.middleware";
import { loginSchema, forgotPasswordSchema, resetPasswordSchema } from "@/schema/auth.schema";
import { authRequired } from "@/middlewares/auth.middleware";

const router = Router();

// POST /api/auth/login
router.post("/login", validateBody(loginSchema), authController.login);

// POST /api/auth/logout
router.post("/logout", authController.logout);

// GET /api/auth/me
router.get("/me", authRequired, authController.me);

// POST /api/auth/forgot-password — emails a reset link if the address is registered
router.post("/forgot-password", validateBody(forgotPasswordSchema), authController.forgotPassword);

// POST /api/auth/reset-password — consumes the token from the emailed link
router.post("/reset-password", validateBody(resetPasswordSchema), authController.resetPassword);

export default router;
