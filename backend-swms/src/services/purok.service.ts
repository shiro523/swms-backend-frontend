import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { purokRepository } from "@/repositories/purok.repository";
import { userRepository } from "@/repositories/user.repository";
import { mapPurok, mapAccount } from "@/utils/mappers";
import { getDbNow } from "@/lib/dbTime";
import { HttpError, isUniqueConflict } from "@/middlewares/error.middleware";
import type { AuthContext } from "@/lib/token";

const RESTORE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export const purokService = {
  // Admin sees every active purok by default (or every archived one, with
  // includeArchived); a purok-leader sees only their own, and sees nothing
  // if it's currently archived — their operational access is blocked until
  // it's restored (Batch D), matching scope.ts's household/trash-log/
  // payment/notification scoping.
  async list(user: AuthContext, includeArchived = false) {
    const archiveFilter = includeArchived ? { archivedAt: { not: null } } : { archivedAt: null };
    const roleFilter =
      user.role === "purok-leader"
        ? user.purokArchived
          ? { id: "__none__" }
          : { id: user.purokId ?? "__none__" }
        : {};
    const rows = await purokRepository.findMany({ ...archiveFilter, ...roleFilter });
    return rows.map(mapPurok);
  },

  async create(input: {
    name: string;
    leaderName: string;
    complianceRate: number;
    username: string;
    password: string;
    email: string;
  }) {
    const username = input.username.trim().toLowerCase();
    const email = input.email.trim().toLowerCase();
    if (await userRepository.findByUsername(username)) {
      throw new HttpError(400, "That username is already taken.");
    }
    if (await userRepository.findByEmail(email)) {
      throw new HttpError(400, "That email is already registered.");
    }
    const passwordHash = await bcrypt.hash(input.password, 10);

    const id = `p-${randomUUID().slice(0, 8)}`;
    try {
      await purokRepository.createWithLeader({
        id,
        name: input.name,
        leaderName: input.leaderName,
        complianceRate: input.complianceRate,
        user: { username, passwordHash, email },
      });
    } catch (err) {
      // The pre-checks above narrow the common case; these catch the rare
      // race where another request wins between check and insert. (Purok
      // itself has no unique constraint beyond its generated id.)
      if (isUniqueConflict(err, "users_username_key")) {
        throw new HttpError(409, "That username is already taken.");
      }
      if (isUniqueConflict(err, "users_email_key")) {
        throw new HttpError(409, "That email is already registered.");
      }
      throw err;
    }
    const row = await purokRepository.findByIdWithCount(id);
    return mapPurok(row);
  },

  async update(
    purokId: string,
    input: { name?: string; leaderName?: string; username?: string; email?: string },
  ) {
    const purok = await purokRepository.findById(purokId);
    if (!purok) {
      throw new HttpError(404, "Purok not found");
    }

    const purokData: { name?: string; leaderName?: string } = {};
    if (input.name?.trim()) purokData.name = input.name.trim();
    if (input.leaderName?.trim()) purokData.leaderName = input.leaderName.trim();
    if (Object.keys(purokData).length > 0) {
      await purokRepository.update(purokId, purokData);
    }

    if (input.username || input.email) {
      const leader = await userRepository.findLeaderByPurokId(purokId);
      if (leader) {
        const accountData: { username?: string; email?: string; name?: string } = {};
        if (input.username) {
          const username = input.username.trim().toLowerCase();
          const existing = await userRepository.findByUsername(username);
          if (existing && existing.id !== leader.id) {
            throw new HttpError(400, "That username is already taken.");
          }
          accountData.username = username;
        }
        if (input.email) {
          const email = input.email.trim().toLowerCase();
          const existing = await userRepository.findByEmail(email);
          if (existing && existing.id !== leader.id) {
            throw new HttpError(400, "That email is already registered.");
          }
          accountData.email = email;
        }
        if (purokData.leaderName) accountData.name = purokData.leaderName;
        await userRepository.updateAccount(leader.id, accountData);
      }
    }

    const row = await purokRepository.findByIdWithCount(purokId);
    return mapPurok(row);
  },

  // Archiving never touches households/users/notifications — it only sets a
  // timestamp. All historical data (households, trash logs, payments,
  // violations, family members) stays exactly as it was; only the purok
  // stops appearing in the default (active) list and its leader's
  // operational scope goes empty until restored.
  async archive(purokId: string) {
    const purok = await purokRepository.findById(purokId);
    if (!purok) {
      throw new HttpError(404, "Purok not found");
    }
    if (purok.archivedAt) {
      throw new HttpError(400, "This purok is already archived.");
    }
    const now = await getDbNow();
    const row = await purokRepository.archive(purokId, now);
    return mapPurok(row);
  },

  // Restorable only within the 30-day window — checked against the database's
  // own clock, never the app server's or the browser's, so the answer is
  // consistent regardless of where this request originates.
  async restore(purokId: string) {
    const purok = await purokRepository.findById(purokId);
    if (!purok) {
      throw new HttpError(404, "Purok not found");
    }
    if (!purok.archivedAt) {
      throw new HttpError(400, "This purok is not archived.");
    }
    const now = await getDbNow();
    if (now.getTime() - purok.archivedAt.getTime() > RESTORE_WINDOW_MS) {
      throw new HttpError(400, "This purok was archived more than 30 days ago and can no longer be restored.");
    }
    const row = await purokRepository.restore(purokId);
    return mapPurok(row);
  },

  // Hard delete — the only genuinely destructive operation in this feature.
  // Every check below must pass before anything is touched; if any fails,
  // nothing is modified. Never cascades households/trash logs/payments/
  // violations/family members — those are only ever removed by removing the
  // households themselves first (a separate, existing flow). The one
  // exception is the purok's own leader account, which IS deleted here,
  // atomically with the purok itself (see deleteWithLeader) — that account
  // always exists because createWithLeader() always creates it, so treating
  // it as a blocker would make permanent deletion unreachable for every
  // normally-created purok. This is not a general user-delete feature: it
  // only ever removes the one leader account this purok itself owns.
  //
  // Deliberately NOT time-gated on RESTORE_WINDOW_MS — that window governs
  // only how long restore() stays available (see above). An admin may
  // permanently delete an archived purok immediately, provided it has zero
  // households and no other unexpected dependents; the only thing that
  // changes after 30 days is that restore is no longer an option.
  async permanentlyDelete(purokId: string) {
    const purok = await purokRepository.findById(purokId);
    if (!purok) {
      throw new HttpError(404, "Purok not found");
    }
    if (!purok.archivedAt) {
      throw new HttpError(400, "Only an archived purok can be permanently deleted.");
    }
    const deps = await purokRepository.countDependents(purokId);
    if (deps.households > 0 || deps.users > 0 || deps.notifications > 0) {
      throw new HttpError(
        409,
        "This purok still has households, accounts, or notifications referencing it and cannot be permanently deleted.",
      );
    }
    await purokRepository.deleteWithLeader(purokId);
  },

  // Every login account tied to a purok: its leader plus every resident
  // whose household falls under it.
  async getAccounts(purokId: string) {
    const purok = await purokRepository.findById(purokId);
    if (!purok) {
      throw new HttpError(404, "Purok not found");
    }
    const [leader, residents] = await Promise.all([
      userRepository.findLeaderByPurokId(purokId),
      userRepository.findResidentsByPurokId(purokId),
    ]);
    return {
      leader: leader ? mapAccount(leader) : null,
      residents: residents.map(mapAccount),
    };
  },
};
