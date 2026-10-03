import { randomUUID } from "crypto";
import { trashLogRepository } from "@/repositories/trashLog.repository";
import { householdRepository } from "@/repositories/household.repository";
import { violationRepository } from "@/repositories/violation.repository";
import { settingsRepository } from "@/repositories/settings.repository";
import { mapTrashLog } from "@/utils/mappers";
import { relationScopedWhere, canAccessHousehold } from "@/utils/scope";
import { getDbToday, getDbTodayAndTime } from "@/lib/dbTime";
import {
  addDays,
  collectionWeekStart,
  parseCollectionWeekday,
  toIsoDate,
  weekdayName,
} from "@/lib/collectionWeek";
import { HttpError, isUniqueConflict } from "@/middlewares/error.middleware";
import type { AuthContext } from "@/lib/token";

// Trash is collected once a week, so a household gets one log per
// collection week (see lib/collectionWeek.ts) — not one per day.
const DUPLICATE_LOG_MESSAGE = "This household has already been logged for this collection week.";

// Missed collections are only auto-recorded from this collection day on —
// never backfilled into history from before the feature existed, which
// would suddenly rewrite every older household's compliance rate.
const MISSED_TRACKING_START = new Date(Date.UTC(2026, 9, 4)); // Sunday, 2026-10-04
// How many past collection weeks a catch-up run looks at (e.g. after the
// server was asleep/offline for a while).
const MISSED_LOOKBACK_WEEKS = 8;

async function getCollectionWeekday() {
  const settings = await settingsRepository.get();
  return parseCollectionWeekday(settings.collectionDays);
}

// findDuplicate() below can still lose a race to a concurrent request — the
// database's own trash_logs_household_id_log_date_key unique index (H-5) is
// what actually guarantees no duplicate is ever stored. This narrowly
// translates *that specific* conflict into the same 409 the pre-check
// already returns, instead of letting it fall through to a generic 500.
// Deliberately narrow: must not swallow an unrelated P2002 from elsewhere.
function isTrashLogDateConflict(err: unknown): boolean {
  return isUniqueConflict(err, "trash_logs_household_id_log_date_key");
}

interface CreateTrashLogInput {
  householdId: string;
  status: "compliant" | "violation" | "missed";
  disposedBy: "owner" | "representative";
  notes?: string;
}

export const trashLogService = {
  async list(user: AuthContext, householdId?: string) {
    const rows = await trashLogRepository.findMany(relationScopedWhere(user, householdId));
    return rows.map(mapTrashLog);
  },

  async getById(user: AuthContext, id: string) {
    const row = await trashLogRepository.findById(id);
    // Same generic 404 whether the row doesn't exist or exists but is out of
    // this user's scope — never reveals which, matching every other
    // single-record lookup in this app (see household.service.ts's getById).
    if (!row || !canAccessHousehold(user, row.household)) {
      throw new HttpError(404, "TrashLog not found");
    }
    return mapTrashLog(row);
  },

  async create(user: AuthContext, input: CreateTrashLogInput) {
    const household = await householdRepository.findRawById(input.householdId);
    if (!canAccessHousehold(user, household)) {
      throw new HttpError(404, "Household not found in your scope.");
    }
    if (household!.removedAt) {
      throw new HttpError(400, "This household has been removed and can no longer be logged.");
    }

    const [{ today, time }, collectionWeekday] = await Promise.all([getDbTodayAndTime(), getCollectionWeekday()]);
    const weekStart = collectionWeekStart(today, collectionWeekday);

    // One log per collection week. An auto-recorded "missed" log for this
    // week doesn't block a late pickup — the new log replaces it.
    const existing = await trashLogRepository.findInRange(input.householdId, weekStart, addDays(weekStart, 7));
    if (existing && existing.status !== "missed") {
      throw new HttpError(409, DUPLICATE_LOG_MESSAGE);
    }
    const replaceMissedLogId = existing?.id ?? null;

    const id = `tl-${randomUUID()}`;
    const notes = input.notes ?? null;

    // If this collection was a violation, record it in the violations ledger too.
    // A household is a "repeat offender" once it already has a prior violation
    // on record — that also decides how this one is categorized.
    let violationData: {
      id: string;
      householdId: string;
      type: string;
      vDate: Date;
      isRepeat: boolean;
      notes: string;
    } | null = null;

    if (input.status === "violation") {
      const priorViolations = await violationRepository.countByHousehold(input.householdId);
      const isRepeat = priorViolations > 0;
      violationData = {
        id: `v-${randomUUID()}`,
        householdId: input.householdId,
        type: isRepeat ? "Repeat Violation" : "Improper Segregation",
        vDate: today,
        isRepeat,
        notes: notes ?? "Violation recorded during scheduled collection.",
      };
    }

    try {
      await trashLogRepository.createWithViolation(
        {
          id,
          householdId: input.householdId,
          logDate: today,
          logTime: time,
          collector: user.name,
          status: input.status,
          disposedBy: input.disposedBy,
          notes,
        },
        violationData,
        { purokId: household!.purokId, code: household!.code },
        replaceMissedLogId,
      );
    } catch (err) {
      if (isTrashLogDateConflict(err)) {
        throw new HttpError(409, DUPLICATE_LOG_MESSAGE);
      }
      throw err;
    }

    const row = await trashLogRepository.findById(id);
    return mapTrashLog(row);
  },

  // The current collection week, for the scan screen's "already collected
  // this week" hint (Settings itself is admin-only).
  async currentCollectionWeek() {
    const [today, settings] = await Promise.all([getDbToday(), settingsRepository.get()]);
    const collectionWeekday = parseCollectionWeekday(settings.collectionDays);
    const weekStart = collectionWeekStart(today, collectionWeekday);
    // Today if today is collection day, otherwise the next one.
    const nextCollection = weekStart.getTime() === today.getTime() ? today : addDays(weekStart, 7);
    return {
      collectionDay: weekdayName(collectionWeekday),
      collectionTime: settings.collectionTime || null,
      weekStart: toIsoDate(weekStart),
      weekEnd: toIsoDate(addDays(weekStart, 6)),
      nextCollectionDate: toIsoDate(nextCollection),
    };
  },

  // Records "missed" for every active household that had no log during a
  // collection week whose collection day has fully passed. Safe to run any
  // number of times (see trashLogRepository.createMissedForWeek). Run by the
  // scheduled job in jobs/missedCollections.ts; the options exist for tests.
  async markMissedCollections(
    options: { today?: Date; collectionWeekday?: number; householdWhere?: Record<string, unknown> } = {},
  ) {
    const [today, collectionWeekday] = await Promise.all([
      options.today ?? getDbToday(),
      options.collectionWeekday ?? getCollectionWeekday(),
    ]);
    const thisWeekStart = collectionWeekStart(today, collectionWeekday);
    // On the collection day itself, that day's collection is still under way.
    const lastPassed = thisWeekStart.getTime() < today.getTime() ? thisWeekStart : addDays(thisWeekStart, -7);
    const lookbackLimit = addDays(lastPassed, -7 * (MISSED_LOOKBACK_WEEKS - 1));
    const earliest = lookbackLimit > MISSED_TRACKING_START ? lookbackLimit : MISSED_TRACKING_START;

    let created = 0;
    for (let weekStart = lastPassed; weekStart >= earliest; weekStart = addDays(weekStart, -7)) {
      created += await trashLogRepository.createMissedForWeek(weekStart, addDays(weekStart, 7), options.householdWhere);
    }
    return created;
  },
};
