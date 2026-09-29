import { randomUUID } from "crypto";
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
  //
  // When a violation is recorded, this also creates its two notifications
  // (household-specific for the resident, purok-wide for the leader) inside
  // this SAME transaction (Batch E) — so a rolled-back or never-committed
  // violation can never leave an orphaned notification behind, and a retried
  // request that hits the existing trash-log duplicate protection never
  // double-creates either.
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
    notifyHousehold: { purokId: string; code: string },
  ) {
    return prisma.$transaction(async (tx) => {
      const log = await tx.trashLog.create({ data: logData });
      if (violationData) {
        await tx.violation.create({ data: violationData });

        const today = violationData.vDate;
        await tx.notification.create({
          data: {
            id: `n-${randomUUID().slice(0, 8)}`,
            title: "Violation Notice",
            message: `${violationData.type} recorded for your household.`,
            type: "violation",
            nDate: today,
            targetHouseholdId: violationData.householdId,
            targetPurokId: null,
            leaderOnly: false,
          },
        });
        // leaderOnly: true — this purok-wide alert is for the leader only; an
        // ordinary Admin purok announcement leaves this at its schema default
        // (false) and still reaches residents (Batch E correction).
        await tx.notification.create({
          data: {
            id: `n-${randomUUID().slice(0, 8)}`,
            title: "Violation Notice",
            message: `${violationData.type} recorded for household ${notifyHousehold.code}.`,
            type: "violation",
            nDate: today,
            targetPurokId: notifyHousehold.purokId,
            targetHouseholdId: null,
            leaderOnly: true,
          },
        });
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
