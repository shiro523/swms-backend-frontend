import { prisma } from "@/lib/prisma";

// Read "now" from Postgres rather than the Node process so log dates/times are
// consistent regardless of the app server's local clock/timezone.

export async function getDbToday(): Promise<Date> {
  const rows = await prisma.$queryRaw<{ today: Date }[]>`SELECT CURRENT_DATE AS today`;
  return rows[0].today;
}

export async function getDbTodayAndTime(): Promise<{ today: Date; time: string }> {
  const rows = await prisma.$queryRaw<{ today: Date; time: string }[]>`
    SELECT CURRENT_DATE AS today, to_char(now(), 'HH12:MI AM') AS time
  `;
  return rows[0];
}

// Full timestamp (not just the calendar date) — used where sub-day precision
// matters, e.g. Purok archive/restore-window arithmetic (Batch D).
export async function getDbNow(): Promise<Date> {
  const rows = await prisma.$queryRaw<{ now: Date }[]>`SELECT NOW() AS now`;
  return rows[0].now;
}
