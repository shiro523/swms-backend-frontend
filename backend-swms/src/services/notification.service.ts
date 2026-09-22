import { randomUUID } from "crypto";
import { notificationRepository } from "@/repositories/notification.repository";
import { householdRepository } from "@/repositories/household.repository";
import { mapNotification } from "@/utils/mappers";
import { getDbToday } from "@/lib/dbTime";
import { HttpError } from "@/middlewares/error.middleware";
import type { AuthContext } from "@/lib/token";

const DEFAULT_TITLE: Record<string, string> = {
  collection: "Collection Schedule",
  payment: "Payment Reminder",
  violation: "Violation Notice",
};

// Resolve the purok a user's notifications should be scoped to: a
// purok-leader has it directly on their account, a resident only has it via
// their household.
async function scopePurokId(user: AuthContext): Promise<string | null> {
  if (user.role === "purok-leader") return user.purokId;
  if (user.role === "resident" && user.householdId) {
    const household = await householdRepository.findRawById(user.householdId);
    return household?.purokId ?? null;
  }
  return null;
}

export const notificationService = {
  async list(user: AuthContext) {
    // Admins see every notification, including purok-targeted ones. Everyone
    // else sees barangay-wide announcements plus anything aimed at their own
    // purok — never notifications meant for a different purok.
    let where: Record<string, unknown> = {};
    if (user.role !== "admin") {
      const purokId = await scopePurokId(user);
      where = { OR: [{ targetPurokId: null }, ...(purokId ? [{ targetPurokId: purokId }] : [])] };
    }
    const rows = await notificationRepository.findMany(where);
    return rows.map(mapNotification);
  },

  async create(input: { type: "collection" | "payment" | "violation"; message: string; title?: string; targetPurokId?: string }) {
    const title = input.title?.trim() || DEFAULT_TITLE[input.type];
    const today = await getDbToday();
    const id = `n-${randomUUID().slice(0, 8)}`;
    const row = await notificationRepository.create({
      id,
      title,
      message: input.message,
      type: input.type,
      nDate: today,
      targetPurokId: input.targetPurokId || null,
    });
    return mapNotification(row);
  },

  // Notifications aren't owned by an individual user — they're either
  // barangay-wide or purok-targeted (see list() above). "Can this user mark
  // it read" reuses that exact same visibility rule: you can only touch a
  // notification you're allowed to see. Out-of-scope is reported as 404, not
  // 403, matching canAccessHousehold()'s existing convention elsewhere.
  async markRead(user: AuthContext, id: string) {
    const notification = await notificationRepository.findById(id);
    if (!notification) {
      throw new HttpError(404, "Notification not found.");
    }
    if (user.role !== "admin") {
      const purokId = await scopePurokId(user);
      const visible = notification.targetPurokId === null || notification.targetPurokId === purokId;
      if (!visible) {
        throw new HttpError(404, "Notification not found.");
      }
    }
    const updated = await notificationRepository.markRead(id);
    return mapNotification(updated);
  },
};
