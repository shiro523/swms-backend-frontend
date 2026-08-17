import type { Request, Response, NextFunction } from "express";
import type { ZodType } from "zod";

// Parses req.body against `schema`, replacing it with the parsed (typed,
// defaulted) value. Responds 400 with the first issue's message on failure.
export function validateBody(schema: ZodType) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const message = result.error.issues[0]?.message ?? "Invalid request body.";
      return res.status(400).json({ error: message });
    }
    req.body = result.data;
    return next();
  };
}
