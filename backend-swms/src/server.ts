import app from "@/app";
import { config } from "@/config/env";
import { startMissedCollectionsJob } from "@/jobs/missedCollections";

app.listen(config.port, () => {
  console.log(`SWMS API listening on http://localhost:${config.port}`);
  // Started here, not in app.ts, so the test suite (which imports app
  // directly) never runs the job against the test database on its own.
  startMissedCollectionsJob();
});
