import { randomUUID } from "crypto";
import { notificationRepository } from "@/repositories/notification.repository";
import { householdRepository } from "@/repositories/household.repository";
import { purokRepository } from "@/repositories/purok.repository";
import { mapNotification } from "@/utils/mappers";
import { getDbToday } from "@/lib/dbTime";
import { HttpError } from "@/middlewares/error.middleware";
import type { AuthContext } from "@/lib/token";

const DEFAULT_TITLE: Record<string, string> = {
  collection: "Collection Schedule",
  payment: "Payment Reminder",
  violation: "Violation Notice",
};

type NotificationTarget = { targetPurokId: string | null; targetHouseholdId: string | null; leaderOnly: boolean };

// A resident's own purok isn't on their AuthContext — only their household is
// — so it's resolved via their household, exactly like the pre-Batch-E
// scopePurokId() did. Only called when actually needed (a purok-wide,
// non-leader-only notification is in play), not on every request.
async function residentPurokId(user: AuthContext): Promise<string | null> {
  if (!user.householdId) return null;
  const household = await householdRepository.findRawById(user.householdId);
  return household?.purokId ?? null;
}

// The complete list-query visibility rule for one role (Batch E, corrected).
// Admin has no filter. A purok-leader sees barangay-wide plus every purok-wide
// notification targeting their own purok — both ordinary announcements and
// leader-only alerts — never a household-specific one, and nothing
// purok-scoped while their purok is archived (Batch D). A resident sees
// barangay-wide, their own household's household-specific notifications, and
// purok-wide notifications targeting their own purok that are NOT leaderOnly
// — leaderOnly exists specifically so an automatic violation alert can reach
// the leader without also reaching every resident in the purok, while an
// ordinary Admin purok announcement (leaderOnly defaults to false) still
// reaches residents exactly as it did before Batch E.
async function notificationVisibilityWhere(user: AuthContext): Promise<Record<string, unknown> | undefined> {
  switch (user.role) {
    case "admin":
      return undefined;
    case "purok-leader": {
      const barangayWide = { targetPurokId: null, targetHouseholdId: null };
      if (user.purokArchived || !user.purokId) return barangayWide;
      return { OR: [barangayWide, { targetPurokId: user.purokId, targetHouseholdId: null }] };
    }
    case "resident": {
      const barangayWide = { targetPurokId: null, targetHouseholdId: null };
      const or: Record<string, unknown>[] = [barangayWide];
      if (user.householdId) or.push({ targetHouseholdId: user.householdId });
      const purokId = await residentPurokId(user);
      if (purokId) or.push({ targetPurokId: purokId, targetHouseholdId: null, leaderOnly: false });
      return { OR: or };
    }
    default:
      // Unknown role: match nothing rather than leak data.
      return { id: "__none__" };
  }
}

// Single-row twin of notificationVisibilityWhere(), for endpoints that
// already have one notification in hand (mark-read) and just need a yes/no —
// mirrors this codebase's existing canAccessHousehold()/householdScopeWhere()
// split in scope.ts. Kept in lockstep with notificationVisibilityWhere() by
// construction: same three branches, same leaderOnly rule.
async function isNotificationVisible(user: AuthContext, n: NotificationTarget): Promise<boolean> {
  if (user.role === "admin") return true;
  const barangayWide = n.targetPurokId === null && n.targetHouseholdId === null;
  if (barangayWide) return true;
  if (user.role === "purok-leader") {
    if (user.purokArchived) return false;
    return n.targetHouseholdId === null && n.targetPurokId === user.purokId;
  }
  if (user.role === "resident") {
    if (n.targetHouseholdId !== null) return n.targetHouseholdId === user.householdId;
    if (n.targetPurokId !== null && !n.leaderOnly) {
      const purokId = await residentPurokId(user);
      return n.targetPurokId === purokId;
    }
    return false;
  }
  return false;
}

export const notificationService = {
  async list(user: AuthContext) {
    const where = await notificationVisibilityWhere(user);
    const rows = await notificationRepository.findMany(where ?? {}, Number(user.id));
    return rows.map(mapNotification);
  },

  // Admin-only manual broadcast. Stays barangay-wide or purok-wide, as
  // before — household-specific targeting is only ever produced by the
  // automatic violation/payment triggers, not exposed here (Batch E).
  async create(
    input: { type: "collection" | "payment" | "violation"; message: string; title?: string; targetPurokId?: string },
    viewerId: number,
  ) {
    if (input.targetPurokId && !(await purokRepository.findById(input.targetPurokId))) {
      throw new HttpError(400, "That purok does not exist.");
    }
    const title = input.title?.trim() || DEFAULT_TITLE[input.type];
    const today = await getDbToday();
    const id = `n-${randomUUID().slice(0, 8)}`;
    const row = await notificationRepository.create(
      {
        id,
        title,
        message: input.message,
        type: input.type,
        nDate: today,
        targetPurokId: input.targetPurokId || null,
        targetHouseholdId: null,
      },
      viewerId,
    );
    return mapNotification(row);
  },

  // Per-user read state (Batch E) — reuses the exact same visibility rule as
  // list(), so a user can never mark-read something they couldn't otherwise
  // see. Out-of-scope is reported as 404, not 403, matching this codebase's
  // existing convention elsewhere (see canAccessHousehold()).
  async markRead(user: AuthContext, id: string) {
    const notification = await notificationRepository.findById(id);
    if (!notification || !(await isNotificationVisible(user, notification))) {
      throw new HttpError(404, "Notification not found.");
    }
    const viewerId = Number(user.id);
    await notificationRepository.markRead(id, viewerId);
    const [updated] = await notificationRepository.findMany({ id }, viewerId);
    return mapNotification(updated);
  },

  // The server is the sole source of truth for "unread" — never derived from
  // frontend state. Unread means: visible to this user AND no NotificationRead
  // row exists for them yet.
  async unreadCount(user: AuthContext) {
    const where = await notificationVisibilityWhere(user);
    const count = await notificationRepository.countUnread(where ?? {}, Number(user.id));
    return { count };
  },
};
