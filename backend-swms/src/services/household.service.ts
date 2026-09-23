import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { householdRepository } from "@/repositories/household.repository";
import { userRepository } from "@/repositories/user.repository";
import { mapHousehold, mapFamilyMember } from "@/utils/mappers";
import { householdScopeWhere, canAccessHousehold } from "@/utils/scope";
import { getDbToday } from "@/lib/dbTime";
import { HttpError, isUniqueConflict } from "@/middlewares/error.middleware";
import type { AuthContext } from "@/lib/token";

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
  async list(user: AuthContext) {
    const where = householdScopeWhere(user);
    const rows = await householdRepository.findMany(where);
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
};
