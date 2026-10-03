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
};
