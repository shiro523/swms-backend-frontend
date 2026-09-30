// Authenticates through the real POST /api/auth/login endpoint — never
// fabricates a JWT by hand — so tests exercise the actual login flow
// (bcrypt comparison, cookie issuance, rate limiter) exactly as a real
// client would. request.agent() persists the httpOnly session cookie
// across subsequent requests made with the returned agent, the same way a
// browser session would. An unauthenticated request needs no helper at all
// — just testRequest() directly, with no prior login call.
import request from "supertest";
import app from "@/app";

export async function loginAs(username: string, password: string) {
  const agent = request.agent(app);
  const res = await agent.post("/api/auth/login").send({ username, password });
  if (res.status !== 200) {
    throw new Error(
      `loginAs("${username}") failed: expected 200, got ${res.status} — ${JSON.stringify(res.body)}`,
    );
  }
  return agent;
}
