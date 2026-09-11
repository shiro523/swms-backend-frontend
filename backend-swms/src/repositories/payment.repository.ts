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

  create(data: {
    id: string;
    householdId: string;
    period: string;
    amount: number;
    status: string;
    datePaid: Date;
    orNumber: string | null;
  }) {
    return prisma.payment.create({ data });
  },
};
