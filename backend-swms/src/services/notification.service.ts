import { randomUUID } from "crypto";
import { notificationRepository } from "@/repositories/notification.repository";
import { mapNotification } from "@/utils/mappers";
import { getDbToday } from "@/lib/dbTime";

const DEFAULT_TITLE: Record<string, string> = {
  collection: "Collection Schedule",
  payment: "Payment Reminder",
  violation: "Violation Notice",
};

export const notificationService = {
  async list() {
    const rows = await notificationRepository.findMany();
    return rows.map(mapNotification);
  },

  async create(input: { type: "collection" | "payment" | "violation"; message: string; title?: string }) {
    const title = input.title?.trim() || DEFAULT_TITLE[input.type];
    const today = await getDbToday();
    const id = `n-${randomUUID().slice(0, 8)}`;
    const row = await notificationRepository.create({
      id,
      title,
      message: input.message,
      type: input.type,
      nDate: today,
    });
    return mapNotification(row);
  },
};
