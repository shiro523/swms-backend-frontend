import { prisma } from "@/lib/prisma";

const TRASH_LOG_INCLUDE = {
  household: { include: { purok: true } },
};

export const trashLogRepository = {
  findMany(where: Record<string, unknown>) {
    return prisma.trashLog.findMany({
      where,
      include: TRASH_LOG_INCLUDE,
      orderBy: [{ logDate: "desc" }, { createdAt: "desc" }],
    });
  },

  findById(id: string) {
    return prisma.trashLog.findUnique({ where: { id }, include: TRASH_LOG_INCLUDE });
  },

  findDuplicate(householdId: string, logDate: Date) {
    return prisma.trashLog.findFirst({ where: { householdId, logDate } });
  },

  // Inserts the trash log and — when a violation record accompanies it — the
  // matching violations-ledger row, atomically. Also recomputes the
  // household's compliance rate from its real collection history, so the
  // number reflects what actually happened instead of staying frozen at
  // whatever it was set to at registration.
  createWithViolation(
    logData: {
      id: string;
      householdId: string;
      logDate: Date;
      logTime: string;
      collector: string;
      status: string;
      disposedBy: string;
      notes: string | null;
    },
    violationData: { id: string; householdId: string; type: string; vDate: Date; isRepeat: boolean; notes: string } | null,
  ) {
    return prisma.$transaction(async (tx) => {
      const log = await tx.trashLog.create({ data: logData });
      if (violationData) {
        await tx.violation.create({ data: violationData });
      }

      const [totalLogs, compliantLogs] = await Promise.all([
        tx.trashLog.count({ where: { householdId: logData.householdId } }),
        tx.trashLog.count({ where: { householdId: logData.householdId, status: "compliant" } }),
      ]);
      const complianceRate = totalLogs > 0 ? Math.round((compliantLogs / totalLogs) * 100) : 100;
      const household = await tx.household.update({
        where: { id: logData.householdId },
        data: { complianceRate },
        select: { purokId: true },
      });

      // The purok's own compliance figure is the average across its households
      // — keep it in sync now that one of them just changed.
      const purokAvg = await tx.household.aggregate({
        where: { purokId: household.purokId },
        _avg: { complianceRate: true },
      });
      await tx.purok.update({
        where: { id: household.purokId },
        data: { complianceRate: Math.round(purokAvg._avg.complianceRate ?? 100) },
      });

      return log;
    });
  },
};
