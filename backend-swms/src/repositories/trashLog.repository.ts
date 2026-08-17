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
  // matching violations-ledger row, atomically.
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
      return log;
    });
  },
};
