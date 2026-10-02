import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";

const PAYMENT_INCLUDE = { household: { include: { purok: true } } };

export const paymentRepository = {
  // Most-recent-paid first, like every other scoped list in this app
  // (trashLogRepository/notificationRepository both order by date desc) —
  // household.code as a secondary tiebreak only, never the primary key.
  // Without the datePaid ordering, two payments for the same household
  // come back in whatever order Postgres happens to return them (observed
  // in practice as insertion order, but never guaranteed), so anything
  // that assumed "last in the list = most recently paid" — the Resident
  // dashboard's latestPayment — could silently show the wrong payment.
  findMany(where: Record<string, unknown>) {
    return prisma.payment.findMany({
      where,
      include: PAYMENT_INCLUDE,
      orderBy: [{ datePaid: "desc" }, { household: { code: "asc" } }],
    });
  },

  findById(id: string) {
    return prisma.payment.findUnique({ where: { id }, include: PAYMENT_INCLUDE });
  },

  // Creates the payment and its household-specific notification atomically
  // (Batch E) — no purok-leader notification, per the approved design. Both
  // inserts share the payment's own uniqueness constraint
  // (@@unique([householdId, period])): if that insert fails, the whole
  // transaction rolls back and no notification is left behind; a retried
  // duplicate request never creates a second one.
  createWithNotification(
    data: {
      id: string;
      householdId: string;
      period: string;
      amount: number;
      status: string;
      datePaid: Date;
    },
    notification: { message: string; nDate: Date },
  ) {
    return prisma.$transaction([
      prisma.payment.create({ data }),
      prisma.notification.create({
        data: {
          id: `n-${randomUUID().slice(0, 8)}`,
          title: "Payment Recorded",
          message: notification.message,
          type: "payment",
          nDate: notification.nDate,
          targetHouseholdId: data.householdId,
          targetPurokId: null,
        },
      }),
    ]);
  },
};
