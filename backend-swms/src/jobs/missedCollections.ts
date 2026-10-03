import { trashLogService } from "@/services/trashLog.service";

// Auto-records missed weekly collections (see
// trashLogService.markMissedCollections). Runs shortly after startup — which
// also catches up after the free-tier host was asleep — and then hourly, so
// households are marked within an hour of a collection day ending.
const RUN_EVERY_MS = 60 * 60 * 1000;
const FIRST_RUN_DELAY_MS = 10 * 1000;

async function run() {
  try {
    const created = await trashLogService.markMissedCollections();
    if (created > 0) {
      console.log(`Recorded ${created} missed collection(s).`);
    }
  } catch (err) {
    console.error("Failed to record missed collections:", err);
  }
}

export function startMissedCollectionsJob() {
  setTimeout(() => void run(), FIRST_RUN_DELAY_MS).unref();
  setInterval(() => void run(), RUN_EVERY_MS).unref();
}
