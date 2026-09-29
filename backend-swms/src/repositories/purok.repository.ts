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

  archive(id: string, at: Date) {
    return prisma.purok.update({
      where: { id },
      data: { archivedAt: at },
      include: { _count: { select: { households: true } } },
    });
  },

  restore(id: string) {
    return prisma.purok.update({
      where: { id },
      data: { archivedAt: null },
      include: { _count: { select: { households: true } } },
    });
  },

  // Every direct dependency that must be zero before a permanently-archived
  // purok can be hard-deleted — see schema.prisma: Household (cascade),
  // User (set null), Notification (cascade) are the only three direct
  // relations into Purok. Never delete through this without checking these.
  async countDependents(id: string) {
    const [households, users, notifications] = await Promise.all([
      prisma.household.count({ where: { purokId: id } }),
      prisma.user.count({ where: { purokId: id } }),
      prisma.notification.count({ where: { targetPurokId: id } }),
    ]);
    return { households, users, notifications };
  },

  // Only ever called after purokService's full safety-check chain passes —
  // this method itself performs no checks, matching this codebase's existing
  // repository/service split (repositories are mechanical, services hold
  // the business rules).
  delete(id: string) {
    return prisma.purok.delete({ where: { id } });
  },
};
