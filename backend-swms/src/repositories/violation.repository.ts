import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";

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
