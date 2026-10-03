// Supertest wraps the Express app object directly and starts its own
// ephemeral listener per request — it never calls src/server.ts's
// app.listen(), so tests never start (or need to stop) a persistent
// production server. app.ts already exports the Express app on its own,
// independent of server.ts, so no restructuring was needed for this.
import request from "supertest";
import app from "@/app";

export function testRequest() {
  return request(app);
}
