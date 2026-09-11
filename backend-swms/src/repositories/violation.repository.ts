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

  countByHousehold(householdId: string) {
    return prisma.violation.count({ where: { householdId } });
  },
};
