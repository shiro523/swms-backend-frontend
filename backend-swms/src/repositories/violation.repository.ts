import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { CONSEQUENCE_NOTICE_TITLE, VIOLATION_NOTICE_THRESHOLD } from "@/lib/violationPolicy";

const VIOLATION_INCLUDE = { household: { include: { purok: true } } };

export const violationRepository = {
  findMany(where: Record<string, unknown>) {
    return prisma.violation.findMany({
      where,
      include: VIOLATION_INCLUDE,
      orderBy: { vDate: "desc" },
    });
  },

  findById(id: string) {
    return prisma.violation.findUnique({ where: { id }, include: VIOLATION_INCLUDE });
  },

  // Deliberately unconditional — every violation ever recorded for this
  // household counts toward repeat-offense detection, regardless of
  // lifecycle status (Batch H: completed violations still count). Never
  // filter this by status.
  // Active households (matching `householdWhere`) with at least
  // VIOLATION_NOTICE_THRESHOLD violations on record, with their totals and
  // the date of the last consequence notice sent to them (if any).
  async householdsAtThreshold(householdWhere: Record<string, unknown>) {
    const grouped = await prisma.violation.groupBy({
      by: ["householdId"],
      where: { household: { ...householdWhere, removedAt: null } },
      _count: { _all: true },
      having: { householdId: { _count: { gte: VIOLATION_NOTICE_THRESHOLD } } },
    });
    if (grouped.length === 0) return [];
    const ids = grouped.map((g) => g.householdId);
    const [households, active, notices] = await Promise.all([
      prisma.household.findMany({ where: { id: { in: ids } }, include: { purok: true } }),
      prisma.violation.groupBy({
        by: ["householdId"],
        where: { householdId: { in: ids }, status: "active" },
        _count: { _all: true },
      }),
      prisma.notification.groupBy({
        by: ["targetHouseholdId"],
        where: { targetHouseholdId: { in: ids }, title: CONSEQUENCE_NOTICE_TITLE },
        _max: { nDate: true },
        _count: { _all: true },
      }),
    ]);
    return grouped.map((g) => {
      const h = households.find((x) => x.id === g.householdId)!;
      const notice = notices.find((n) => n.targetHouseholdId === g.householdId);
      return {
        householdId: h.id,
        householdCode: h.code,
        representative: h.representative,
        purokName: h.purok.name,
        totalViolations: g._count._all,
        activeViolations: active.find((a) => a.householdId === g.householdId)?._count._all ?? 0,
        noticesSent: notice?._count._all ?? 0,
        lastNoticeDate: notice?._max.nDate ?? null,
      };
    });
  },

  createConsequenceNotice(householdId: string, message: string, nDate: Date) {
    return prisma.notification.create({
      data: {
        id: `n-${randomUUID().slice(0, 8)}`,
        title: CONSEQUENCE_NOTICE_TITLE,
        message,
        type: "violation",
        nDate,
        targetHouseholdId: householdId,
        targetPurokId: null,
        leaderOnly: false,
      },
    });
  },

  countByHousehold(householdId: string) {
    return prisma.violation.count({ where: { householdId } });
  },

  // Atomic with its completion notification (Batch H) — mirrors
  // paymentRepository.createWithNotification's exact array-transaction
  // pattern. If either statement fails, neither commits.
  complete(
    id: string,
    resolvedAt: Date,
    resolvedByName: string,
    notification: { householdId: string; message: string; nDate: Date },
  ) {
    return prisma.$transaction([
      prisma.violation.update({
        where: { id },
        data: { status: "completed", resolvedAt, resolvedByName },
        include: VIOLATION_INCLUDE,
      }),
      prisma.notification.create({
        data: {
          id: `n-${randomUUID().slice(0, 8)}`,
          title: "Violation Completed",
          message: notification.message,
          type: "violation",
          nDate: notification.nDate,
          targetHouseholdId: notification.householdId,
          targetPurokId: null,
          leaderOnly: false,
        },
      }),
    ]);
  },
};
