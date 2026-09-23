import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { purokRepository } from "@/repositories/purok.repository";
import { userRepository } from "@/repositories/user.repository";
import { mapPurok, mapAccount } from "@/utils/mappers";
import { HttpError, isUniqueConflict } from "@/middlewares/error.middleware";
import type { AuthContext } from "@/lib/token";

export const purokService = {
  // Admin sees every purok; a purok leader sees only their own.
  async list(user: AuthContext) {
    const where = user.role === "purok-leader" ? { id: user.purokId ?? "__none__" } : {};
    const rows = await purokRepository.findMany(where);
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
