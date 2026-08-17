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
};
