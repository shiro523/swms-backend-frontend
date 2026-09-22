import { prisma } from "@/lib/prisma";

export const notificationRepository = {
  findMany(where: Record<string, unknown>) {
    return prisma.notification.findMany({
      where,
      include: { targetPurok: true },
      orderBy: [{ nDate: "desc" }, { id: "desc" }],
    });
  },

  findById(id: string) {
    return prisma.notification.findUnique({ where: { id }, include: { targetPurok: true } });
  },

  markRead(id: string) {
    return prisma.notification.update({ where: { id }, data: { isRead: true }, include: { targetPurok: true } });
  },

  create(data: {
    id: string;
    title: string;
    message: string;
    type: string;
    nDate: Date;
    targetPurokId: string | null;
  }) {
    return prisma.notification.create({ data, include: { targetPurok: true } });
  },
};
