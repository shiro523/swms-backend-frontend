import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { householdRepository } from "@/repositories/household.repository";
import { userRepository } from "@/repositories/user.repository";
import { mapHousehold, mapFamilyMember } from "@/utils/mappers";
import { householdScopeWhere, canAccessHousehold } from "@/utils/scope";
import { getDbToday, getDbNow } from "@/lib/dbTime";
import { HttpError, isUniqueConflict } from "@/middlewares/error.middleware";
import type { AuthContext } from "@/lib/token";

// Mirrors purokService's exact RESTORE_WINDOW_MS constant and usage — the
// recovery period is calculated from removedAt (never a fixed calendar
// date), and expiring the window only stops restore() from succeeding. It
// never triggers deletion on its own; permanentlyDelete() remains a
// separate, explicit admin action both within and after this window.
const RESTORE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

interface CreateHouseholdInput {
  representative: string;
  address: string;
  contactNumber: string;
  purokId?: string;
  members: { name: string; relation?: string; age: number }[];
  username: string;
  password: string;
  email: string;
}

interface UpdateHouseholdInput {
  representative?: string;
  contactNumber?: string;
  address?: string;
  username?: string;
  email?: string;
}

interface AddMemberInput {
  name: string;
  relation?: string;
  age: number;
}

async function getById(user: AuthContext, id: string, skipAccessCheck = false) {
  if (!skipAccessCheck) {
    const raw = await householdRepository.findRawById(id);
    if (!canAccessHousehold(user, raw)) {
      throw new HttpError(404, "Household not found");
    }
  }
  const row = await householdRepository.findById(id);
  if (!row) throw new HttpError(404, "Household not found");
  return mapHousehold(row);
}

export const householdService = {
  // Removed households are excluded by default — matching purokService's
  // active/archived split — so a removed household naturally disappears
  // from every "active" list (purok-leader's own, admin's default view)
  // without touching any of its historical data. includeRemoved flips that
  // to show only the removed ones, mirroring ?archived=true on puroks.
  async list(user: AuthContext, includeRemoved = false) {
    const where = householdScopeWhere(user);
    const removedFilter = includeRemoved ? { removedAt: { not: null } } : { removedAt: null };
    const rows = await householdRepository.findMany({ ...where, ...removedFilter });
    return rows.map(mapHousehold);
  },

  async create(user: AuthContext, input: CreateHouseholdInput) {
    // A leader can only register into their own purok; an admin picks one.
    const purokId = user.role === "purok-leader" ? user.purokId : input.purokId;
    if (!purokId) {
      throw new HttpError(400, "Representative, address, contact number, and purok are required.");
    }
    const purok = await householdRepository.findPurokById(purokId);
    if (!purok) {
      throw new HttpError(400, "That purok does not exist.");
    }

    const username = input.username.trim().toLowerCase();
    const email = input.email.trim().toLowerCase();
    if (await userRepository.findByUsername(username)) {
      throw new HttpError(400, "That username is already taken.");
    }
    if (await userRepository.findByEmail(email)) {
      throw new HttpError(400, "That email is already registered.");
    }
    const passwordHash = await bcrypt.hash(input.password, 10);

    const code = await householdRepository.nextCode();
    const id = `hh-${randomUUID()}`;
    const today = await getDbToday();

    const members = input.members
      .map((m, idx) => {
        const name = m.name?.trim();
        const relation = m.relation?.trim() || "Member";
        const age = Number(m.age);
        if (!name || Number.isNaN(age)) return null;
        return { id: `${id}-m${idx + 1}`, name, relation, age };
      })
      .filter((m): m is { id: string; name: string; relation: string; age: number } => m !== null);

    try {
      await householdRepository.createWithMembers({
        id,
        code,
        representative: input.representative,
        address: input.address,
        purokId,
        contactNumber: input.contactNumber,
        registeredAt: today,
        members,
        user: { username, passwordHash, email, name: input.representative },
      });
    } catch (err) {
      // The pre-checks above narrow the common case; these catch the rare
      // race where another request wins between check and insert.
      if (isUniqueConflict(err, "households_code_key")) {
        throw new HttpError(409, "A household code conflict occurred. Please try again.");
      }
      if (isUniqueConflict(err, "users_username_key")) {
        throw new HttpError(409, "That username is already taken.");
      }
      if (isUniqueConflict(err, "users_email_key")) {
        throw new HttpError(409, "That email is already registered.");
      }
      throw err;
    }

    return getById(user, id, true);
  },

  getById,

  async update(user: AuthContext, id: string, input: UpdateHouseholdInput) {
    const raw = await householdRepository.findRawById(id);
    if (!canAccessHousehold(user, raw)) {
      throw new HttpError(404, "Household not found");
    }
    const data: Record<string, string> = {};
    if (input.representative?.trim()) data.representative = input.representative.trim();
    if (input.contactNumber?.trim()) data.contactNumber = input.contactNumber.trim();
    if (input.address?.trim()) data.address = input.address.trim();
    if (Object.keys(data).length === 0 && !input.username && !input.email) {
      throw new HttpError(400, "Nothing to update.");
    }
    if (Object.keys(data).length > 0) {
      await householdRepository.update(id, data);
    }

    if (input.username || input.email) {
      const resident = await userRepository.findByHouseholdId(id);
      if (resident) {
        const accountData: { username?: string; email?: string; name?: string } = {};
        if (input.username) {
          const username = input.username.trim().toLowerCase();
          const existing = await userRepository.findByUsername(username);
          if (existing && existing.id !== resident.id) {
            throw new HttpError(400, "That username is already taken.");
          }
          accountData.username = username;
        }
        if (input.email) {
          const email = input.email.trim().toLowerCase();
          const existing = await userRepository.findByEmail(email);
          if (existing && existing.id !== resident.id) {
            throw new HttpError(400, "That email is already registered.");
          }
          accountData.email = email;
        }
        if (data.representative) accountData.name = data.representative;
        await userRepository.updateAccount(resident.id, accountData);
      }
    }

    return getById(user, id, true);
  },

  async addMember(user: AuthContext, householdId: string, input: AddMemberInput) {
    const raw = await householdRepository.findRawById(householdId);
    if (!canAccessHousehold(user, raw)) {
      throw new HttpError(404, "Household not found");
    }
    const name = input.name.trim();
    const relation = input.relation?.trim() || "Member";
    const age = Number(input.age);
    if (!name || Number.isNaN(age)) {
      throw new HttpError(400, "Name and a valid age are required.");
    }
    const id = `${householdId}-m-${randomUUID().slice(0, 8)}`;
    const member = await householdRepository.addMember({ id, householdId, name, relation, age });
    return mapFamilyMember(member);
  },

  // Same scope check as addMember (any role that can access this household
  // — admin any, purok-leader their own purok, resident only their own
  // household). The householdId-match check below is a second, independent
  // guard: even if a caller's OWN household passes canAccessHousehold, this
  // still rejects a memberId that actually belongs to a DIFFERENT
  // household — the concrete attack this closes is a resident supplying
  // their own householdId in the URL but another household's memberId.
  async updateMember(
    user: AuthContext,
    householdId: string,
    memberId: string,
    input: { name?: string; relation?: string; age?: number },
  ) {
    const raw = await householdRepository.findRawById(householdId);
    if (!canAccessHousehold(user, raw)) {
      throw new HttpError(404, "Household not found");
    }
    const member = await householdRepository.findMemberById(memberId);
    if (!member || member.householdId !== householdId) {
      throw new HttpError(404, "Family member not found");
    }
    const data: { name?: string; relation?: string; age?: number } = {};
    if (input.name?.trim()) data.name = input.name.trim();
    if (input.relation?.trim()) data.relation = input.relation.trim();
    if (input.age !== undefined) {
      const age = Number(input.age);
      if (Number.isNaN(age)) {
        throw new HttpError(400, "A valid age is required.");
      }
      data.age = age;
    }
    if (Object.keys(data).length === 0) {
      throw new HttpError(400, "Nothing to update.");
    }
    const updated = await householdRepository.updateMember(memberId, data);
    return mapFamilyMember(updated);
  },

  async removeMember(user: AuthContext, householdId: string, memberId: string) {
    const raw = await householdRepository.findRawById(householdId);
    if (!canAccessHousehold(user, raw)) {
      throw new HttpError(404, "Household not found");
    }
    const member = await householdRepository.findMemberById(memberId);
    if (!member || member.householdId !== householdId) {
      throw new HttpError(404, "Family member not found");
    }
    await householdRepository.deleteMember(memberId);
  },

  // Soft-removal: a purok-leader may remove a household in their own purok
  // (e.g. the resident permanently left the barangay); admin may remove
  // any. Never deletes anything — TrashLog/Violation/Payment/FamilyMember
  // all remain exactly as they were, fully visible to Admin. A removed
  // household's own resident is blocked from further authenticated access
  // in authRequired() (auth.middleware.ts), and trashLogService.create()
  // refuses new collections for it — both re-check removedAt fresh from the
  // database on every request, never trusting a stale client value.
  async remove(user: AuthContext, householdId: string, reason: string) {
    const raw = await householdRepository.findRawById(householdId);
    if (!canAccessHousehold(user, raw)) {
      throw new HttpError(404, "Household not found");
    }
    if (raw!.removedAt) {
      throw new HttpError(400, "This household has already been removed.");
    }
    const now = await getDbNow();
    const row = await householdRepository.remove(householdId, {
      removedAt: now,
      removalReason: reason,
      removedByName: user.name,
    });
    return mapHousehold(row);
  },

  // Admin-only (enforced by requireRole("admin") at the route level, same
  // pattern as purokService.restore()) — reverses a removal, exactly as
  // recorded, but only within the 30-day recovery window measured from
  // removedAt against the database's own clock (never the app server's or
  // the browser's — same reasoning as purokService.restore()). Once that
  // window has passed, restore is no longer available and the household
  // waits for an explicit permanentlyDelete() instead; nothing here ever
  // deletes it automatically. Historical records were never touched by the
  // removal in the first place, so there is nothing to reconstruct.
  async restore(householdId: string) {
    const raw = await householdRepository.findRawById(householdId);
    if (!raw) {
      throw new HttpError(404, "Household not found");
    }
    if (!raw.removedAt) {
      throw new HttpError(400, "This household is not removed.");
    }
    const now = await getDbNow();
    if (now.getTime() - raw.removedAt.getTime() > RESTORE_WINDOW_MS) {
      throw new HttpError(400, "This household was removed more than 30 days ago and can no longer be restored.");
    }
    const row = await householdRepository.restore(householdId);
    return mapHousehold(row);
  },

  // Hard delete — admin-only (enforced by requireRole("admin") at the route
  // level, same as purokService.permanentlyDelete), and only ever reachable
  // for an already-removed household: this check is the real enforcement,
  // never the frontend hiding the button. Cascades every dependent record
  // (see householdRepository.deleteWithResident) — there is no dependency
  // count to inspect first, unlike purok's permanent delete, because a
  // household's dependents (trash logs, violations, payments, family
  // members, its own resident account) exist BECAUSE of it and are meant to
  // go with it, not block it.
  async permanentlyDelete(householdId: string) {
    const raw = await householdRepository.findRawById(householdId);
    if (!raw) {
      throw new HttpError(404, "Household not found");
    }
    if (!raw.removedAt) {
      throw new HttpError(400, "Only a removed household can be permanently deleted.");
    }
    await householdRepository.deleteWithResident(householdId);
  },
};
