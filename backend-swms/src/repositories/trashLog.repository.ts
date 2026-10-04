import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { VIOLATION_LIMIT_ALERT_TITLE, VIOLATION_NOTICE_THRESHOLD } from "@/lib/violationPolicy";
import type { Prisma } from "@/generated/prisma/client";

type Tx = Prisma.TransactionClient;

// A household's compliance rate from its real collection history (missed
// collections count against it). With no logs at all it stays at the
// placeholder 100 — see Household.hasCollectionRecords on the API.
async function recomputeHouseholdCompliance(tx: Tx, householdId: string) {
  const [totalLogs, compliantLogs] = await Promise.all([
    tx.trashLog.count({ where: { householdId } }),
    tx.trashLog.count({ where: { householdId, status: "compliant" } }),
  ]);
  const complianceRate = totalLogs > 0 ? Math.round((compliantLogs / totalLogs) * 100) : 100;
  const household = await tx.household.update({
    where: { id: householdId },
    data: { complianceRate },
    select: { purokId: true },
  });
  return household.purokId;
}

// The purok's own compliance figure is the average across its households.
// Only households with at least one log count: a household with none still
// carries the placeholder 100%, which would inflate the average.
async function recomputePurokCompliance(tx: Tx, purokId: string) {
  const purokAvg = await tx.household.aggregate({
    where: { purokId, trashLogs: { some: {} } },
    _avg: { complianceRate: true },
  });
  await tx.purok.update({
    where: { id: purokId },
    data: { complianceRate: Math.round(purokAvg._avg.complianceRate ?? 100) },
  });
}

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

  // The household's log within [from, to) — one collection week — if any.
  findInRange(householdId: string, from: Date, to: Date) {
    return prisma.trashLog.findFirst({ where: { householdId, logDate: { gte: from, lt: to } } });
  },

  // Records a "missed" log, dated on the collection day, for every active
  // household (in an active purok, registered by that day, matching
  // `householdWhere`) with no log in [weekStart, weekEnd). Idempotent: a
  // household that already has a log that week is skipped, and the
  // (householdId, logDate) unique index backs that up. Returns the count.
  async createMissedForWeek(weekStart: Date, weekEnd: Date, householdWhere: Record<string, unknown> = {}) {
    const households = await prisma.household.findMany({
      where: {
        ...householdWhere,
        removedAt: null,
        purok: { archivedAt: null },
        registeredAt: { lte: weekStart },
        trashLogs: { none: { logDate: { gte: weekStart, lt: weekEnd } } },
      },
      select: { id: true },
    });
    if (households.length === 0) return 0;

    return prisma.$transaction(async (tx) => {
      const created = await tx.trashLog.createMany({
        data: households.map((h) => ({
          id: `tl-${randomUUID()}`,
          householdId: h.id,
          logDate: weekStart,
          logTime: "—",
          collector: "System",
          status: "missed",
          disposedBy: "representative",
          notes: "No collection was recorded for this household during this collection week.",
        })),
        skipDuplicates: true,
      });
      const purokIds = new Set<string>();
      for (const h of households) {
        purokIds.add(await recomputeHouseholdCompliance(tx, h.id));
      }
      for (const purokId of purokIds) {
        await recomputePurokCompliance(tx, purokId);
      }
      return created.count;
    }, { timeout: 60_000 });
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
    // A late pickup scanned after the household was auto-marked "missed" for
    // this collection week replaces that missed log (one log per week).
    replaceMissedLogId: string | null = null,
  ) {
    return prisma.$transaction(async (tx) => {
      if (replaceMissedLogId) {
        await tx.trashLog.deleteMany({ where: { id: replaceMissedLogId, status: "missed" } });
      }
      const log = await tx.trashLog.create({ data: logData });
      if (violationData) {
        await tx.violation.create({ data: violationData });

        const today = violationData.vDate;
        // Household/resident-facing content — states only real data already
        // on violationData (type, date), plus a fixed compliance instruction.
        // Never fabricates anything not already in the database.
        await tx.notification.create({
          data: {
            id: `n-${randomUUID().slice(0, 8)}`,
            title: "Waste Segregation Violation",
            message: `Your household was recorded with ${/^[aeiou]/i.test(violationData.type) ? "an" : "a"} ${violationData.type} violation on ${violationData.vDate.toISOString().slice(0, 10)}. Please comply with the barangay's waste segregation rules to avoid further violations.`,
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
            // Distinct from "Violation Notice" (the admin's own messages to a
            // household), so the two never look alike in the admin's list.
            title: "Violation Recorded",
            message: `${violationData.type} recorded for household ${notifyHousehold.code}.`,
            type: "violation",
            nDate: today,
            targetPurokId: notifyHousehold.purokId,
            targetHouseholdId: null,
            leaderOnly: true,
          },
        });

        // At (and past) the limit: flag it to the purok leader and the admin
        // (leaderOnly keeps it from residents; admins see every notice). The
        // consequence notice itself is the admin's call — see
        // violationService.sendConsequenceNotice.
        const total = await tx.violation.count({ where: { householdId: violationData.householdId } });
        if (total >= VIOLATION_NOTICE_THRESHOLD) {
          await tx.notification.create({
            data: {
              id: `n-${randomUUID().slice(0, 8)}`,
              title: VIOLATION_LIMIT_ALERT_TITLE,
              message: `Household ${notifyHousehold.code} now has ${total} violations on record (limit: ${VIOLATION_NOTICE_THRESHOLD}). The admin can send a consequence notice from the Violations page.`,
              type: "violation",
              nDate: today,
              targetPurokId: notifyHousehold.purokId,
              targetHouseholdId: null,
              leaderOnly: true,
            },
          });
        }
      }

      const purokId = await recomputeHouseholdCompliance(tx, logData.householdId);
      await recomputePurokCompliance(tx, purokId);

      return log;
    });
  },
};
