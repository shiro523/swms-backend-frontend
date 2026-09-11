import { prisma } from "@/lib/prisma";

export const notificationRepository = {
  findMany(where: Record<string, unknown>) {
    return prisma.notification.findMany({
      where,
      include: { targetPurok: true },
      orderBy: [{ nDate: "desc" }, { id: "desc" }],
    });
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
