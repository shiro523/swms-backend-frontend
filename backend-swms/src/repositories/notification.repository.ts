import { prisma } from "@/lib/prisma";

export const notificationRepository = {
  findMany() {
    return prisma.notification.findMany({ orderBy: [{ nDate: "desc" }, { id: "desc" }] });
  },

  create(data: { id: string; title: string; message: string; type: string; nDate: Date }) {
    return prisma.notification.create({ data });
  },
};
