import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { config } from "@/config/env";

// pg's default idleTimeoutMillis is 10s: after any 10-second pause every
// pooled connection was closed, and the next request paid a fresh TCP + TLS
// handshake to the hosted DB (~600ms). Keep idle connections for 5 minutes
// instead; keepAlive stops NATs/the Neon pooler from silently dropping them.
// A connection that does get dropped while idle is discarded by the pool
// (the adapter handles idle-client errors) and simply re-opened on demand.
const adapter = new PrismaPg({
  connectionString: config.databaseUrl,
  idleTimeoutMillis: 5 * 60 * 1000,
  keepAlive: true,
});
// Prisma's defaults (2s to start a transaction, 5s to finish) are too tight
// for a hosted DB that can be slow to answer — e.g. while Neon wakes from
// idle, or under load — and failed saves with "Unable to start a
// transaction in the given time". These only raise the ceilings; a healthy
// transaction still takes milliseconds.
const prisma = new PrismaClient({
  adapter,
  transactionOptions: { maxWait: 10_000, timeout: 20_000 },
});

export { prisma };
