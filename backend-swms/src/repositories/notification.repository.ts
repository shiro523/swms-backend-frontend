import { prisma } from "@/lib/prisma";

// Only the current viewer's own read row is ever loaded — a notification can
// be visible to many users, but each one only needs to know about their own
// read state, never anyone else's (Batch E).
const include = (viewerId: number) => ({
  targetPurok: true,
  targetHousehold: true,
  reads: { where: { userId: viewerId } },
});

export const notificationRepository = {
  findMany(where: Record<string, unknown>, viewerId: number) {
    return prisma.notification.findMany({
      where,
      include: include(viewerId),
      orderBy: [{ nDate: "desc" }, { id: "desc" }],
    });
  },

  findById(id: string) {
    return prisma.notification.findUnique({ where: { id } });
  },

  // Idempotent by construction: the composite (notificationId, userId) key
  // means a repeated mark-read for the same user is a no-op update, never a
  // duplicate row, and never touches any other user's read state.
  markRead(id: string, userId: number) {
    return prisma.notificationRead.upsert({
      where: { notificationId_userId: { notificationId: id, userId } },
      create: { notificationId: id, userId },
      update: {},
    });
  },

  countUnread(where: Record<string, unknown>, viewerId: number) {
    return prisma.notification.count({
      where: { AND: [where, { reads: { none: { userId: viewerId } } }] },
    });
  },

  create(
    data: {
      id: string;
      title: string;
      message: string;
      type: string;
      nDate: Date;
      targetPurokId: string | null;
      targetHouseholdId: string | null;
    },
    viewerId: number,
  ) {
    return prisma.notification.create({ data, include: include(viewerId) });
  },
};
