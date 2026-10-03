import { prisma } from "@/lib/prisma";

export const statsRepository = {
  // Bare fields needed to bucket trash-log activity by month and status,
  // filtered to whatever the caller's role-scope `where` allows.
  trashLogsSince(where: Record<string, unknown>, since: Date) {
    return prisma.trashLog.findMany({
      where: { ...where, logDate: { gte: since } },
      select: { logDate: true, status: true },
    });
  },

  // Only "paid" rows count as collected revenue. householdId is included so
  // the service can compute how many distinct households paid each month
  // (Batch F: the real configured fee needs a household count to multiply
  // against for that month's target).
  paidPaymentsSince(where: Record<string, unknown>, since: Date) {
    return prisma.payment.findMany({
      where: { ...where, status: "paid", datePaid: { gte: since } },
      select: { datePaid: true, amount: true, householdId: true },
    });
  },

  // --- Admin dashboard summary -------------------------------------------
  // Counts computed in the DB, so the dashboard no longer downloads every
  // household, payment, violation, and trash log just to count them.

  // Same population as GET /households (active households only).
  countActiveHouseholds() {
    return prisma.household.count({ where: { removedAt: null } });
  },

  // Active households with at least one payment for `period`. Matches the
  // frontend's splitHouseholdsByCurrentPeriod exactly: trimmed,
  // case-insensitive period comparison, any number of payments per period.
  async countActiveHouseholdsPaidFor(period: string) {
    const rows = await prisma.$queryRaw<{ paid: number }[]>`
      SELECT COUNT(*)::int AS paid
      FROM households h
      WHERE h.removed_at IS NULL
        AND EXISTS (
          SELECT 1 FROM payments p
          WHERE p.household_id = h.id
            AND LOWER(TRIM(p.period)) = LOWER(TRIM(${period}))
        )
    `;
    return rows[0].paid;
  },

  // Active households registered in [monthStart, nextMonthStart) with no
  // payment for `period` — shown as "new" rather than "unpaid", matching
  // Household.periodPaymentStatus (see householdService).
  async countActiveNewUnpaid(period: string, monthStart: Date, nextMonthStart: Date) {
    const rows = await prisma.$queryRaw<{ count: number }[]>`
      SELECT COUNT(*)::int AS count
      FROM households h
      WHERE h.removed_at IS NULL
        AND h.registered_at >= ${monthStart}
        AND h.registered_at < ${nextMonthStart}
        AND NOT EXISTS (
          SELECT 1 FROM payments p
          WHERE p.household_id = h.id
            AND LOWER(TRIM(p.period)) = LOWER(TRIM(${period}))
        )
    `;
    return rows[0].count;
  },

  countActivePuroks() {
    return prisma.purok.count({ where: { archivedAt: null } });
  },

  // Compliance rates of active households that have at least one trash log
  // (households with none have no real rate yet).
  activeHouseholdRatesWithRecords() {
    return prisma.household.findMany({
      where: { removedAt: null, trashLogs: { some: {} } },
      select: { complianceRate: true },
    });
  },

  countActiveViolations() {
    return prisma.violation.count({ where: { status: "active" } });
  },

  // Same ordering as GET /trash-logs, limited to the newest few.
  recentTrashLogs(take: number) {
    return prisma.trashLog.findMany({
      include: { household: { include: { purok: true } } },
      orderBy: [{ logDate: "desc" }, { createdAt: "desc" }],
      take,
    });
  },
};
