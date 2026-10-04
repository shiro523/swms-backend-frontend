// A database that can't be reached must produce a clear 503, not a bare
// "Internal server error"; real bugs still produce a 500.
import { describe, expect, it } from "vitest";
import express from "express";
import request from "supertest";
import { errorHandler, HttpError, isDatabaseUnavailable } from "@/middlewares/error.middleware";

function appThrowing(err: unknown) {
  const app = express();
  app.get("/", () => {
    throw err;
  });
  app.use(errorHandler);
  return app;
}

describe("database-unavailable errors", () => {
  it("recognizes connection failures by Prisma code and by driver message", () => {
    expect(isDatabaseUnavailable({ code: "P1001", message: "Can't reach database server at x" })).toBe(true);
    expect(isDatabaseUnavailable({ code: "P2024", message: "Timed out fetching a new connection" })).toBe(true);
    expect(isDatabaseUnavailable(new Error("getaddrinfo ENOTFOUND ep-x.neon.tech"))).toBe(true);
    expect(
      isDatabaseUnavailable({ message: "Transaction API error: Unable to start a transaction in the given time." }),
    ).toBe(true);
    expect(
      isDatabaseUnavailable({ code: "P2010", meta: { driverAdapterError: { cause: { originalMessage: "connect ECONNREFUSED" } } } }),
    ).toBe(true);
  });

  it("does not treat real query errors as connection failures", () => {
    expect(isDatabaseUnavailable({ code: "P2002", message: "Unique constraint failed" })).toBe(false);
    expect(isDatabaseUnavailable(new TypeError("Cannot read properties of undefined"))).toBe(false);
  });

  it("answers 503 with a clear message when the database is unreachable, 500 otherwise", async () => {
    const offline = await request(appThrowing(new Error("getaddrinfo ENOTFOUND ep-x.neon.tech"))).get("/");
    expect(offline.status).toBe(503);
    expect(offline.body.error).toMatch(/can't reach the database/i);

    const bug = await request(appThrowing(new TypeError("boom"))).get("/");
    expect(bug.status).toBe(500);
    expect(bug.body.error).toBe("Internal server error");

    const expected = await request(appThrowing(new HttpError(409, "Already logged"))).get("/");
    expect(expected.status).toBe(409);
  });
});
