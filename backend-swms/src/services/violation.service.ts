import { violationRepository } from "@/repositories/violation.repository";
import { mapViolation } from "@/utils/mappers";
import { relationScopedWhere, canAccessHousehold, householdScopeWhere } from "@/utils/scope";
import { getDbNow, getDbToday } from "@/lib/dbTime";
import { householdRepository } from "@/repositories/household.repository";
import { VIOLATION_NOTICE_THRESHOLD } from "@/lib/violationPolicy";
import { HttpError } from "@/middlewares/error.middleware";
import type { AuthContext } from "@/lib/token";

export const violationService = {
  async list(user: AuthContext, householdId?: string) {
    const rows = await violationRepository.findMany(relationScopedWhere(user, householdId));
    return rows.map(mapViolation);
  },

  // Marks a violation completed — reuses the exact same household-scoping
  // check every other single-record action in this app already uses
  // (canAccessHousehold), so a purok-leader can no more complete another
  // purok's violation than they can view it, and the same generic 404
  // applies whether the violation doesn't exist or is simply out of scope
  // (never reveals which).
  // Households at or over the violation limit, most violations first —
  // scoped like every other household list (admin: all, leader: own purok).
  async householdsAtLimit(user: AuthContext) {
    const rows = await violationRepository.householdsAtThreshold(householdScopeWhere(user));
    return {
      threshold: VIOLATION_NOTICE_THRESHOLD,
      households: rows
        .map((r) => ({ ...r, lastNoticeDate: r.lastNoticeDate ? r.lastNoticeDate.toISOString().slice(0, 10) : null }))
        .sort((a, b) => b.totalViolations - a.totalViolations),
    };
  },

  // Admin-only (route-gated): sends the household's resident a consequence
  // notice. Only for households that have actually reached the limit.
  async sendConsequenceNotice(householdId: string, message: string) {
    const household = await householdRepository.findRawById(householdId);
    if (!household || household.removedAt) {
      throw new HttpError(404, "Household not found");
    }
    const total = await violationRepository.countByHousehold(householdId);
    if (total < VIOLATION_NOTICE_THRESHOLD) {
      throw new HttpError(
        400,
        `A consequence notice can only be sent once a household has ${VIOLATION_NOTICE_THRESHOLD} violations (this one has ${total}).`,
      );
    }
    const sentOn = await getDbToday();
    await violationRepository.createConsequenceNotice(householdId, message, sentOn);
    return { ok: true, householdId, totalViolations: total, sentOn: sentOn.toISOString().slice(0, 10) };
  },

  async complete(user: AuthContext, id: string) {
    const violation = await violationRepository.findById(id);
    if (!violation || !canAccessHousehold(user, violation.household)) {
      throw new HttpError(404, "Violation not found");
    }
    if (violation.status === "completed") {
      throw new HttpError(400, "This violation has already been completed.");
    }

    const resolvedAt = await getDbNow();
    const [updated] = await violationRepository.complete(id, resolvedAt, user.name, {
      householdId: violation.householdId,
      message: `Your ${violation.type} violation from ${violation.vDate.toISOString().slice(0, 10)} has been marked as completed.`,
      nDate: resolvedAt,
    });
    return mapViolation(updated);
  },
};
