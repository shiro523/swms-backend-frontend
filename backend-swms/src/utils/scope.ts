import type { AuthContext } from "@/lib/token";

// Build a role-based Prisma `where` filter for the households table itself.
// Admins get no filter.
export function householdScopeWhere(user: AuthContext) {
  switch (user.role) {
    case "admin":
      return {};
    case "purok-leader":
      return { purokId: user.purokId ?? "__none__" };
    case "resident":
      return { id: user.householdId ?? "__none__" };
    default:
      // Unknown role: match nothing rather than leak data.
      return { id: "__none__" };
  }
}

// Same idea, but for resources that reference a household via `householdId`
// (trash logs, payments, violations) and need to filter through the relation
// for the purok-leader case.
export function householdRelationScopeWhere(user: AuthContext) {
  switch (user.role) {
    case "admin":
      return {};
    case "purok-leader":
      return { household: { purokId: user.purokId ?? "__none__" } };
    case "resident":
      return { householdId: user.householdId ?? "__none__" };
    default:
      return { householdId: "__none__" };
  }
}

// Combines the relation-based scope with an optional explicit ?householdId=
// filter (both must hold — matches the old backend's AND'd SQL predicates).
export function relationScopedWhere(user: AuthContext, householdId?: string) {
  const conditions: Record<string, unknown>[] = [householdRelationScopeWhere(user)];
  if (householdId) conditions.push({ householdId });
  return conditions.length > 1 ? { AND: conditions } : conditions[0];
}

// True when `user` is allowed to see the given household row.
export function canAccessHousehold(
  user: AuthContext,
  household: { id: string; purokId: string } | null | undefined,
): boolean {
  if (!household) return false;
  switch (user.role) {
    case "admin":
      return true;
    case "purok-leader":
      return household.purokId === user.purokId;
    case "resident":
      return household.id === user.householdId;
    default:
      return false;
  }
}
