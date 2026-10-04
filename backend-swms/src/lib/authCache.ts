// Short-lived, in-process cache of the per-request session check that
// authRequired() does (tokenVersion + purok-archived + household-removed).
// Without it, every API call pays one extra DB round trip before doing any
// real work — and a single page load fires several calls at once.
//
// Correctness doesn't rely on the TTL alone: every write that can change one
// of these cached fields (logout, password reset, purok archive/restore/
// delete, household remove/restore) calls invalidateAuthCache() right after
// it succeeds, so within this process the effect is immediate. The TTL only
// bounds staleness for changes made outside this process (a second server
// instance, or a manual DB edit), which is at most AUTH_CACHE_TTL_MS.

export interface AuthSnapshot {
  tokenVersion: number;
  // Current display name — the JWT copy is frozen at login, so a rename
  // would otherwise keep stamping the old name on new records.
  name: string;
  role: string;
  purokArchived: boolean;
  householdRemoved: boolean;
}

const AUTH_CACHE_TTL_MS = 30 * 1000;

const cache = new Map<number, { snapshot: AuthSnapshot; expiresAt: number }>();

export function getCachedAuth(userId: number): AuthSnapshot | undefined {
  const entry = cache.get(userId);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    cache.delete(userId);
    return undefined;
  }
  return entry.snapshot;
}

export function setCachedAuth(userId: number, snapshot: AuthSnapshot): void {
  cache.set(userId, { snapshot, expiresAt: Date.now() + AUTH_CACHE_TTL_MS });
}

// No argument clears everything — used by purok/household changes, which
// affect every user tied to that purok/household. Cheap: the next request
// per user just repopulates its entry.
export function invalidateAuthCache(userId?: number): void {
  if (userId === undefined) cache.clear();
  else cache.delete(userId);
}
