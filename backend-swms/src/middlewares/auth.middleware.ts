import type { Request, Response, NextFunction } from "express";
import { config } from "@/config/env";
import { verifyToken, type AuthContext } from "@/lib/token";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthContext;
    }
  }
}

// Populates req.user from the auth cookie, or 401s. Downstream handlers can
// rely on req.user = { id, role, name, householdId, purokId }.
export function authRequired(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.[config.cookieName];
  if (!token) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  try {
    req.user = verifyToken(token);
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired session" });
  }
}

// Restrict a route to one or more roles. Use after authRequired.
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    return next();
  };
}
