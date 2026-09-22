import type { Request, Response } from "express";
import { authService } from "@/services/auth.service";
import { signToken, setAuthCookie, clearAuthCookie } from "@/lib/token";

export const authController = {
  async login(req: Request, res: Response) {
    const { username, password } = req.body as { username: string; password: string };
    const user = await authService.login(username.trim().toLowerCase(), password);
    const token = signToken(user);
    setAuthCookie(res, token);
    const { tokenVersion: _tokenVersion, ...publicUser } = user;
    res.json({ user: publicUser });
  },

  logout(_req: Request, res: Response) {
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
