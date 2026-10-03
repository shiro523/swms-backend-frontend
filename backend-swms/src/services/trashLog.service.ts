import { randomUUID } from "crypto";
import { trashLogRepository } from "@/repositories/trashLog.repository";
import { householdRepository } from "@/repositories/household.repository";
import { violationRepository } from "@/repositories/violation.repository";
import { mapTrashLog } from "@/utils/mappers";
import { relationScopedWhere, canAccessHousehold } from "@/utils/scope";
import { getDbTodayAndTime } from "@/lib/dbTime";
import { HttpError, isUniqueConflict } from "@/middlewares/error.middleware";
import type { AuthContext } from "@/lib/token";

const DUPLICATE_LOG_MESSAGE = "This household has already been logged today.";

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

    const { today, time } = await getDbTodayAndTime();

    const dup = await trashLogRepository.findDuplicate(input.householdId, today);
    if (dup) {
      throw new HttpError(409, DUPLICATE_LOG_MESSAGE);
    }

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
};
