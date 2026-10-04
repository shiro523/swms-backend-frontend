import { prisma } from "@/lib/prisma";
import { invalidateAuthCache } from "@/lib/authCache";

// What mapPurok needs from each household: whether it was removed (active
// and removed households are counted separately — removed ones are history,
// but still block permanent deletion), its compliance rate, and whether it
// has any trash logs (the purok figure is the live average over active
// households with logs). Purok.complianceRate as stored lags between logs,
// so it is not displayed.
const PUROK_INCLUDE = {
  households: {
    select: { removedAt: true, complianceRate: true, _count: { select: { trashLogs: true } } },
  },
};

export const purokRepository = {
  findMany(where: Record<string, unknown>) {
    return prisma.purok.findMany({
      where,
      include: PUROK_INCLUDE,
      orderBy: { name: "asc" },
    });
  },
  findByIdWithCount(id: string) {
    return prisma.purok.findUnique({
      where: { id },
      include: PUROK_INCLUDE,
    });
  },
  findById(id: string) {
    return prisma.purok.findUnique({ where: { id } });
  },
  async createWithLeader(data: {
    id: string;
    name: string;
    leaderName: string;
    user: { username: string; passwordHash: string; email: string };
  }) {
    await prisma.$transaction([
      prisma.purok.create({
        // No starting compliance figure: a new purok has no collection
        // records, so its rate is computed only once logs exist (mapPurok).
        data: { id: data.id, name: data.name, leaderName: data.leaderName },
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

  // archive/restore/deleteWithLeader invalidate the auth cache: a leader's
  // access depends on their purok's archived state (see authRequired()).
  async archive(id: string, at: Date) {
    const row = await prisma.purok.update({
      where: { id },
      data: { archivedAt: at },
      include: PUROK_INCLUDE,
    });
    invalidateAuthCache();
    return row;
  },

  async restore(id: string) {
    const row = await prisma.purok.update({
      where: { id },
      data: { archivedAt: null },
      include: PUROK_INCLUDE,
    });
    invalidateAuthCache();
    return row;
  },

  // Every dependency that must be zero before a permanently-archived purok
  // can be hard-deleted — see schema.prisma: Household (cascade), User (set
  // null), Notification (cascade) are the only three direct relations into
  // Purok. Never delete through this without checking these.
  //
  // `users` deliberately excludes the purok's own leader — createWithLeader
  // always creates exactly one purok-leader account tied to purokId, so
  // counting it here would make permanent deletion unreachable for every
  // normally-created purok. That one expected account is handled by
  // deleteWithLeader() below, not treated as a blocker. Any OTHER user
  // still pointing at this purokId (which should never normally happen)
  // still counts and still blocks — this only special-cases the one
  // account this feature itself is responsible for.
  async countDependents(id: string) {
    const [households, users, notifications] = await Promise.all([
      prisma.household.count({ where: { purokId: id } }),
      prisma.user.count({ where: { purokId: id, role: { not: "purok-leader" } } }),
      prisma.notification.count({ where: { targetPurokId: id } }),
    ]);
    return { households, users, notifications };
  },

  // Only ever called after purokService's full safety-check chain passes —
  // this method itself performs no checks, matching this codebase's existing
  // repository/service split (repositories are mechanical, services hold
  // the business rules). Deletes the purok's own leader account and the
  // purok itself atomically — the leader must go first: User.purokId is
  // onDelete: SetNull (not Cascade), so deleting the purok first would only
  // orphan the leader account (purokId -> null), never remove it, leaving a
  // stray login with no purok. Scoped to role: "purok-leader" specifically
  // — never a general user-delete, just the one account this operation owns.
  async deleteWithLeader(id: string) {
    const result = await prisma.$transaction([
      prisma.user.deleteMany({ where: { purokId: id, role: "purok-leader" } }),
      prisma.purok.delete({ where: { id } }),
    ]);
    invalidateAuthCache();
    return result;
  },
};
