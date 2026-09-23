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

// Central error handler. Also catches Zod validation errors thrown by the
// validate() middleware and application errors thrown with a `status`.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  if (err?.status) {
    return res.status(err.status).json({ error: err.message });
  }
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
}

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
