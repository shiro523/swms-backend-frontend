import { prisma } from "@/lib/prisma";

const HOUSEHOLD_INCLUDE = {
  purok: true,
  members: { orderBy: { id: "asc" as const } },
  users: { where: { role: "resident" as const }, take: 1 },
};

export const householdRepository = {
  findMany(where: Record<string, unknown>) {
    return prisma.household.findMany({
      where,
      include: HOUSEHOLD_INCLUDE,
      orderBy: { code: "asc" },
    });
  },

  findById(id: string) {
    return prisma.household.findUnique({ where: { id }, include: HOUSEHOLD_INCLUDE });
  },

  // Bare row (no relations) — used for access-control checks before deciding
  // whether to fetch/return the full record.
  findRawById(id: string) {
    return prisma.household.findUnique({ where: { id } });
  },

  findPurokById(id: string) {
    return prisma.purok.findUnique({ where: { id } });
  },

  async nextCode(): Promise<string> {
    const rows = await prisma.$queryRaw<{ next: number | bigint }[]>`
      SELECT COALESCE(MAX(CAST(SUBSTRING(code FROM 4) AS INTEGER)), 999) + 1 AS next
      FROM households WHERE code LIKE 'HH-%'
    `;
    return `HH-${rows[0].next}`;
  },

  async createWithMembers(data: {
    id: string;
    code: string;
    representative: string;
    address: string;
    purokId: string;
    contactNumber: string;
    registeredAt: Date;
    members: { id: string; name: string; relation: string; age: number }[];
    user: { username: string; passwordHash: string; email: string; name: string };
  }) {
    await prisma.$transaction([
      prisma.household.create({
        data: {
          id: data.id,
          code: data.code,
          representative: data.representative,
          address: data.address,
          purokId: data.purokId,
          contactNumber: data.contactNumber,
          registeredAt: data.registeredAt,
          paymentStatus: "unpaid",
          complianceRate: 100,
        },
      }),
      ...data.members.map((m) =>
        prisma.familyMember.create({
          data: { id: m.id, householdId: data.id, name: m.name, relation: m.relation, age: m.age },
        }),
      ),
      // The resident login account for this household.
      prisma.user.create({
        data: {
          username: data.user.username,
          passwordHash: data.user.passwordHash,
          email: data.user.email,
          role: "resident",
          name: data.user.name,
          householdId: data.id,
        },
      }),
    ]);
  },

  update(id: string, data: { representative?: string; contactNumber?: string; address?: string }) {
    return prisma.household.update({ where: { id }, data });
  },

  updatePaymentStatus(id: string, paymentStatus: string) {
    return prisma.household.update({ where: { id }, data: { paymentStatus } });
  },

  addMember(data: { id: string; householdId: string; name: string; relation: string; age: number }) {
    return prisma.familyMember.create({ data });
  },

  findMemberById(id: string) {
    return prisma.familyMember.findUnique({ where: { id } });
  },

  updateMember(id: string, data: { name?: string; relation?: string; age?: number }) {
    return prisma.familyMember.update({ where: { id }, data });
  },

  deleteMember(id: string) {
    return prisma.familyMember.delete({ where: { id } });
  },

  // Soft-removal only — mirrors purokRepository's archive()/restore() exact
  // pattern. Never touches FamilyMember/TrashLog/Violation/Payment; all
  // historical records stay exactly as they were.
  remove(id: string, data: { removedAt: Date; removalReason: string; removedByName: string }) {
    return prisma.household.update({ where: { id }, data, include: HOUSEHOLD_INCLUDE });
  },

  restore(id: string) {
    return prisma.household.update({
      where: { id },
      data: { removedAt: null, removalReason: null, removedByName: null },
      include: HOUSEHOLD_INCLUDE,
    });
  },

  // Only ever called after householdService's removed-state check passes.
  // The resident account must go first: User.householdId is onDelete:
  // SetNull (not Cascade), so deleting the household first would only
  // orphan that login (householdId -> null), never remove it. Scoped to
  // role: "resident" specifically — mirrors purokRepository.deleteWithLeader's
  // exact reasoning, never a general user-delete.
  //
  // Deleting the household row itself then cascades automatically per
  // schema.prisma: FamilyMember, TrashLog, Violation, Payment, and any
  // household-targeted Notification (which in turn cascades its own
  // NotificationReads) are all onDelete: Cascade on householdId/
  // targetHouseholdId. Nothing else references a household, so nothing
  // else needs to be touched here.
  deleteWithResident(id: string) {
    return prisma.$transaction([
      prisma.user.deleteMany({ where: { householdId: id, role: "resident" } }),
      prisma.household.delete({ where: { id } }),
    ]);
  },
};
