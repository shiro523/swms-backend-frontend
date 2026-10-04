import type { Request, Response, NextFunction } from "express";
import { config } from "@/config/env";
import { verifyToken, type AuthContext } from "@/lib/token";
import { userRepository } from "@/repositories/user.repository";
import { getCachedAuth, setCachedAuth } from "@/lib/authCache";

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
// aspirational. That lookup is cached briefly per user (see authCache.ts) and
// invalidated by every write that could change its result.
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
  // Served from authCache when possible (see authCache.ts for why that stays
  // correct: every write that changes these fields invalidates it).
  const userId = Number(payload.id);
  let auth = getCachedAuth(userId);
  if (!auth) {
    const user = await userRepository.findById(userId);
    if (!user) {
      return res.status(401).json({ error: "Session has been invalidated. Please log in again." });
    }
    auth = {
      tokenVersion: user.tokenVersion,
      name: user.name,
      role: user.role,
      purokArchived: user.purok?.archivedAt != null,
      householdRemoved: user.household?.removedAt != null,
    };
    setCachedAuth(userId, auth);
  }
  if (auth.tokenVersion !== payload.tokenVersion) {
    return res.status(401).json({ error: "Session has been invalidated. Please log in again." });
  }
  // Checked on every request — a household can be removed at any time after
  // a resident's token was already issued, same reasoning as the
  // purokArchived check right below.
  if (auth.role === "resident" && auth.householdRemoved) {
    return res.status(401).json({ error: "This household has been removed. Please contact the barangay office." });
  }
  // Never trust the JWT's own (potentially long-stale) purokId/archive
  // state. A purok can be archived at any time after a leader's token was
  // already issued (see Batch D).
  // name comes from the DB too: it is what gets recorded as collector /
  // removed-by / resolved-by, and the JWT copy is stale after a rename.
  req.user = { ...payload, name: auth.name, purokArchived: auth.purokArchived };
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
