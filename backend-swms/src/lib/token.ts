import jwt from "jsonwebtoken";
import type { Response } from "express";
import { config } from "@/config/env";

export type Role = "admin" | "purok-leader" | "resident";

export interface SessionUser {
  id: number;
  username: string;
  role: Role;
  name: string;
  householdId: string | null;
  purokId: string | null;
  tokenVersion: number;
}

export interface AuthContext {
  id: string;
  role: Role;
  name: string;
  householdId: string | null;
  purokId: string | null;
  // Not a secret — just the counter authRequired() compares against the
  // user's current DB value to reject tokens issued before a password reset.
  tokenVersion: number;
  // Whether the purok this user's purokId points to is currently archived —
  // always computed fresh from the DB in authRequired() (see Batch D), never
  // trusted from the JWT payload, since a purok can be archived at any time
  // after a long-lived token was already issued. verifyToken() below sets a
  // safe false placeholder that authRequired() immediately overwrites.
  purokArchived: boolean;
}

// The JWT payload carries everything middleware needs to scope data without a
// second DB lookup on every request — except tokenVersion, which exists
// specifically so authRequired() CAN do one targeted lookup to check it
// hasn't been invalidated since this token was issued.
export function signToken(user: SessionUser): string {
  return jwt.sign(
    {
      sub: String(user.id),
      role: user.role,
      name: user.name,
      householdId: user.householdId ?? null,
      purokId: user.purokId ?? null,
      tokenVersion: user.tokenVersion,
    },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn as jwt.SignOptions["expiresIn"] },
  );
}

export function verifyToken(token: string): AuthContext {
  const payload = jwt.verify(token, config.jwtSecret) as jwt.JwtPayload;
  return {
    id: String(payload.sub),
    role: payload.role,
    name: payload.name,
    householdId: payload.householdId ?? null,
    purokId: payload.purokId ?? null,
    // Tokens signed before this change carry no tokenVersion claim; treat
    // them as version 0, matching the column's default so existing sessions
    // aren't invalidated by this deployment itself.
    tokenVersion: typeof payload.tokenVersion === "number" ? payload.tokenVersion : 0,
    // Placeholder — authRequired() always overwrites this with a fresh,
    // per-request DB value before req.user is used by anything downstream.
    purokArchived: false,
  };
}

const COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function setAuthCookie(res: Response, token: string): void {
  res.cookie(config.cookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: config.cookieSecure,
    maxAge: COOKIE_MAX_AGE_MS,
    path: "/",
  });
}

export function clearAuthCookie(res: Response): void {
  res.clearCookie(config.cookieName, { path: "/" });
}
