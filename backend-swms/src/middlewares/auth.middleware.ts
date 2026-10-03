import type { Request, Response, NextFunction } from "express";
import { config } from "@/config/env";
import { verifyToken, type AuthContext } from "@/lib/token";
import { userRepository } from "@/repositories/user.repository";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthContext;
    }
  }
}

// Populates req.user from the auth cookie, or 401s. Downstream handlers can
// rely on req.user = { id, role, name, householdId, purokId, tokenVersion }.
//
// This now does one DB lookup per request — a deliberate change from the
// original fully-stateless design (see token.ts's comment). A signature- and
// expiry-valid JWT is no longer sufficient on its own: its tokenVersion claim
// must also match the user's current tokenVersion, or it's been invalidated
// by a password reset since it was issued. At this app's scale (a single
// barangay, not a high-traffic service), one indexed lookup by primary key
// per request is not a meaningful performance cost, and it's the only way to
// make "reset password invalidates old sessions" actually true rather than
// aspirational.
export async function authRequired(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.[config.cookieName];
  if (!token) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  let payload: AuthContext;
  try {
    payload = verifyToken(token);
  } catch {
    return res.status(401).json({ error: "Invalid or expired session" });
  }
  const user = await userRepository.findById(Number(payload.id));
  if (!user || user.tokenVersion !== payload.tokenVersion) {
    return res.status(401).json({ error: "Session has been invalidated. Please log in again." });
  }
  // Fresh on every request — a household can be removed at any time after a
  // resident's token was already issued, same reasoning as the purokArchived
  // check right below.
  if (user.role === "resident" && user.household?.removedAt != null) {
    return res.status(401).json({ error: "This household has been removed. Please contact the barangay office." });
  }
  // Fresh on every request — never trust the JWT's own (potentially
  // long-stale) purokId/archive state. A purok can be archived at any time
  // after a leader's token was already issued (see Batch D).
  req.user = { ...payload, purokArchived: user.purok?.archivedAt != null };
  return next();
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
