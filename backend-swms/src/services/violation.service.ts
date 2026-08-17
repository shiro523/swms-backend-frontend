import { violationRepository } from "@/repositories/violation.repository";
import { mapViolation } from "@/utils/mappers";
import { relationScopedWhere } from "@/utils/scope";
import type { AuthContext } from "@/lib/token";

export const violationService = {
  async list(user: AuthContext, householdId?: string) {
    const rows = await violationRepository.findMany(relationScopedWhere(user, householdId));
    return rows.map(mapViolation);
  },
};
