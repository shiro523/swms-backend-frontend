// Explicit, precisely-scoped cleanup for one fixture run — never a blanket
// wipe. Deletes in an FK-safe order:
//
//   1. Users whose username starts with this run's prefix. User has no
//      required (non-nullable) foreign key pointing at it anywhere in the
//      schema — the one relation that does (NotificationRead.userId) is
//      onDelete: Cascade — so this is always safe regardless of what else
//      exists.
//   2. Puroks whose id starts with this run's prefix. Household.purokId,
//      TrashLog/Violation/Payment (via Household), and
//      Notification.targetPurokId/targetHouseholdId are all onDelete:
//      Cascade in schema.prisma, so deleting the purok cascades away every
//      household, family member, trash log, violation, payment, and
//      household/purok-targeted notification created under it in one step.
//      (User.purokId/householdId are onDelete: SetNull, not Cascade — which
//      is exactly why step 1 deletes users explicitly instead of relying on
//      this cascade to remove them.)
//
// Both deletes use `startsWith` on a runId-scoped prefix, never an unscoped
// condition — there is no code path here that can resolve to "delete
// everything."
import { prisma } from "@/lib/prisma";
import { assertTestEnvironmentActive } from "./testGuard";
import { TEST_USERNAME_PREFIX, testPurokId } from "./ids";

const MIN_RUN_ID_LENGTH = 6;

export async function cleanupTestRun(runId: string): Promise<void> {
  assertTestEnvironmentActive();
  if (!runId || runId.length < MIN_RUN_ID_LENGTH) {
    throw new Error(
      `cleanupTestRun refused: runId "${String(runId)}" is missing or too short to be a safe, ` +
        "specific identifier. Refusing rather than risk an unscoped delete.",
    );
  }

  const usernamePrefix = `${TEST_USERNAME_PREFIX}${runId}-`;
  const purokIdPrefix = testPurokId(runId);

  await prisma.user.deleteMany({ where: { username: { startsWith: usernamePrefix } } });
  await prisma.purok.deleteMany({ where: { id: { startsWith: purokIdPrefix } } });
}
