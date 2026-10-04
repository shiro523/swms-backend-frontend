import type { Request, Response, NextFunction } from "express";
import { Prisma } from "@/generated/prisma/client";

export function notFound(_req: Request, res: Response) {
  res.status(404).json({ error: "Not found" });
}

// Narrow check for a specific Prisma unique-constraint violation, keyed by
// the DB constraint/index name Postgres reports. Lets a service translate
// one *expected* conflict into a clean 409 without swallowing an unrelated
// P2002 (or any other database error) as if it were that conflict.
//
// With the @prisma/adapter-pg driver adapter (used here), Prisma does NOT
// populate the documented err.meta.target — it's undefined. The actual
// constraint name only appears inside the underlying pg error message at
// err.meta.driverAdapterError.cause.originalMessage. Both locations are
// checked so this keeps working if a future Prisma version restores target.
export function isUniqueConflict(err: unknown, constraintName: string): boolean {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== "P2002") {
    return false;
  }
  const meta = err.meta as Record<string, unknown> | undefined;
  const target = meta?.target;
  const targetText = Array.isArray(target) ? target.join(",") : String(target ?? "");
  if (targetText.includes(constraintName)) return true;

  const driverCause = (meta?.driverAdapterError as { cause?: Record<string, unknown> } | undefined)?.cause;
  const originalMessage = String(driverCause?.originalMessage ?? "");
  return originalMessage.includes(constraintName);
}

// The hosted database couldn't be reached at all (no internet, DNS failure,
// Neon unreachable, or no connection free in time) — as opposed to a bug in
// a query. Matched on Prisma's connection error codes and the underlying
// network error text, which is where the pg driver adapter reports them.
const DB_UNAVAILABLE_CODES = new Set(["P1001", "P1002", "P1008", "P1017", "P2024"]);
const DB_UNAVAILABLE_TEXT =
  /can't reach database server|ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ECONNRESET|ETIMEDOUT|Connection terminated|Unable to start a transaction|timeout exceeded when trying to connect/i;

export function isDatabaseUnavailable(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientInitializationError) return true;
  const code = (err as { code?: unknown })?.code;
  if (typeof code === "string" && (DB_UNAVAILABLE_CODES.has(code) || DB_UNAVAILABLE_TEXT.test(code))) return true;
  const meta = (err as { meta?: Record<string, unknown> })?.meta;
  const driverCause = (meta?.driverAdapterError as { cause?: Record<string, unknown> } | undefined)?.cause;
  const text = `${(err as { message?: unknown })?.message ?? ""} ${String(driverCause?.originalMessage ?? "")} ${String(driverCause?.kind ?? "")}`;
  return DB_UNAVAILABLE_TEXT.test(text);
}

// Central error handler. Also catches Zod validation errors thrown by the
// validate() middleware and application errors thrown with a `status`.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  if (err?.status) {
    return res.status(err.status).json({ error: err.message });
  }
  console.error(err);
  // A connection problem, not a bug: say so, so the user knows to retry
  // (nothing was saved) instead of seeing a bare "Internal server error".
  if (isDatabaseUnavailable(err)) {
    return res.status(503).json({
      error: "Can't reach the database right now. Check the internet connection and try again — nothing was saved.",
    });
  }
  res.status(500).json({ error: "Internal server error" });
}

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
