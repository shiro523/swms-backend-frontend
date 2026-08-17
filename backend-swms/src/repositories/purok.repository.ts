import { prisma } from "@/lib/prisma";

export const purokRepository = {
  findMany(where: Record<string, unknown>) {
    return prisma.purok.findMany({
      where,
      include: { _count: { select: { households: true } } },
      orderBy: { name: "asc" },
    });
  },
  findByIdWithCount(id: string) {
    return prisma.purok.findUnique({
      where: { id },
      include: { _count: { select: { households: true } } },
    });
  },
  findById(id: string) {
    return prisma.purok.findUnique({ where: { id } });
  },
  async createWithLeader(data: {
    id: string;
    name: string;
    leaderName: string;
    complianceRate: number;
    user: { username: string; passwordHash: string; email: string };
  }) {
    await prisma.$transaction([
      prisma.purok.create({
        data: { id: data.id, name: data.name, leaderName: data.leaderName, complianceRate: data.complianceRate },
      }),
      // The purok-leader login account for this purok.
      prisma.user.create({
        data: {
          username: data.user.username,
          passwordHash: data.user.passwordHash,
          email: data.user.email,
          role: "purok-leader",
          name: data.leaderName,
          purokId: data.id,
        },
      }),
    ]);
  },
  update(id: string, data: { name?: string; leaderName?: string }) {
    return prisma.purok.update({ where: { id }, data });
  },
};
