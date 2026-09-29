import { violationRepository } from "@/repositories/violation.repository";
import { mapViolation } from "@/utils/mappers";
import { relationScopedWhere, canAccessHousehold } from "@/utils/scope";
import { getDbNow } from "@/lib/dbTime";
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
