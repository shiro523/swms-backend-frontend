import { prisma } from "@/lib/prisma";

export const statsRepository = {
  monthlyCollection() {
    return prisma.monthlyCollectionStat.findMany({ orderBy: { ord: "asc" } });
  },

  paymentCollection() {
    return prisma.paymentCollectionStat.findMany({ orderBy: { ord: "asc" } });
  },
};
