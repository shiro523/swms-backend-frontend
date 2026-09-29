import type { Request, Response } from "express";
import { authService } from "@/services/auth.service";
import { signToken, setAuthCookie, clearAuthCookie } from "@/lib/token";
import { config } from "@/config/env";

export const authController = {
  async login(req: Request, res: Response) {
    const { username, password } = req.body as { username: string; password: string };
    const user = await authService.login(username.trim().toLowerCase(), password);
    const token = signToken(user);
    setAuthCookie(res, token);
    const { tokenVersion: _tokenVersion, ...publicUser } = user;
    res.json({ user: publicUser });
  },

  // Batch J: invalidates the calling user's current session server-side
  // (via tokenVersion) whenever a valid one is actually found, before
  // clearing the cookie — never the other way around, so a genuine DB
  // failure during the invalidation step is never masked by a cookie that's
  // already gone and a response that already claimed success. Deliberately
  // NOT gated behind authRequired: this endpoint has always succeeded
  // regardless of auth state (no cookie, expired token, etc.), and keeping
  // that exact contract avoids a new failure mode for the frontend's
  // existing unconditional logout→redirect flow.
  async logout(req: Request, res: Response) {
    const token = req.cookies?.[config.cookieName];
    await authService.logout(token);
    clearAuthCookie(res);
    res.json({ ok: true });
  },

  async me(req: Request, res: Response) {
    const user = await authService.me(Number(req.user!.id));
    if (!user) {
      clearAuthCookie(res);
      return res.status(401).json({ error: "Session no longer valid" });
    }
    const { tokenVersion: _tokenVersion, ...publicUser } = user;
    res.json({ user: publicUser });
  },

  async forgotPassword(req: Request, res: Response) {
    const { email } = req.body as { email: string };
    await authService.forgotPassword(email);
    // Same response whether or not the email is registered.
    res.json({ ok: true, message: "If that email is registered, a reset link has been sent." });
  },

  async resetPassword(req: Request, res: Response) {
    const { token, password } = req.body as { token: string; password: string };
    await authService.resetPassword(token, password);
    res.json({ ok: true });
  },
};
