import { randomUUID } from "crypto";
import { trashLogRepository } from "@/repositories/trashLog.repository";
import { householdRepository } from "@/repositories/household.repository";
import { violationRepository } from "@/repositories/violation.repository";
import { mapTrashLog } from "@/utils/mappers";
import { relationScopedWhere, canAccessHousehold } from "@/utils/scope";
import { getDbTodayAndTime } from "@/lib/dbTime";
import { HttpError } from "@/middlewares/error.middleware";
import type { AuthContext } from "@/lib/token";

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

  async create(user: AuthContext, input: CreateTrashLogInput) {
    const household = await householdRepository.findRawById(input.householdId);
    if (!canAccessHousehold(user, household)) {
      throw new HttpError(404, "Household not found in your scope.");
    }

    const { today, time } = await getDbTodayAndTime();

    const dup = await trashLogRepository.findDuplicate(input.householdId, today);
    if (dup) {
      throw new HttpError(409, "This household has already been logged today.");
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
    );

    const row = await trashLogRepository.findById(id);
    return mapTrashLog(row);
  },
};
