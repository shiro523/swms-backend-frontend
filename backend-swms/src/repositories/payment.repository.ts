import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";

const PAYMENT_INCLUDE = { household: { include: { purok: true } } };

export const paymentRepository = {
  findMany(where: Record<string, unknown>) {
    return prisma.payment.findMany({
      where,
      include: PAYMENT_INCLUDE,
      orderBy: { household: { code: "asc" } },
    });
  },

  findById(id: string) {
    return prisma.payment.findUnique({ where: { id }, include: PAYMENT_INCLUDE });
  },

  findByOrNumber(orNumber: string) {
    return prisma.payment.findFirst({ where: { orNumber } });
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
      orNumber: string | null;
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
