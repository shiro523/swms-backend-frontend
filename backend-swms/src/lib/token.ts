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
}

export interface AuthContext {
  id: string;
  role: Role;
  name: string;
  householdId: string | null;
  purokId: string | null;
}

// The JWT payload carries everything middleware needs to scope data without a
// second DB lookup on every request.
export function signToken(user: SessionUser): string {
  return jwt.sign(
    {
      sub: String(user.id),
      role: user.role,
      name: user.name,
      householdId: user.householdId ?? null,
      purokId: user.purokId ?? null,
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
