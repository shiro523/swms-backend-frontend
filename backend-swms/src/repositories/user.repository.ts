import { prisma } from "@/lib/prisma";

export const userRepository = {
  findByUsername(username: string) {
    return prisma.user.findUnique({ where: { username } });
  },

  // Includes the user's purok archived state — authRequired() reads this on
  // every request to keep a purok-leader's operational access in sync with
  // their purok's live archive state, never trusting the JWT's stale claim.
  findById(id: number) {
    return prisma.user.findUnique({ where: { id }, include: { purok: { select: { archivedAt: true } } } });
  },

  findByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } });
  },

  setResetToken(id: number, resetTokenHash: string, resetTokenExpiresAt: Date) {
    return prisma.user.update({ where: { id }, data: { resetTokenHash, resetTokenExpiresAt } });
  },

  // A token is only valid while it matches the stored hash AND hasn't expired.
  findByValidResetToken(resetTokenHash: string) {
    return prisma.user.findFirst({
      where: { resetTokenHash, resetTokenExpiresAt: { gt: new Date() } },
    });
  },

  // Bumps tokenVersion in the same atomic update as the password change —
  // any JWT issued before this moment fails authRequired()'s version check
  // on its very next request, regardless of its expiry.
  updatePasswordAndClearReset(id: number, passwordHash: string) {
    return prisma.user.update({
      where: { id },
      data: {
        passwordHash,
        resetTokenHash: null,
        resetTokenExpiresAt: null,
        tokenVersion: { increment: 1 },
      },
    });
  },

  // Same tokenVersion-bump idiom as above, but on its own — logout (Batch J)
  // only ever needs to invalidate existing sessions, never touches
  // passwordHash/resetToken fields the way a password reset does.
  incrementTokenVersion(id: number) {
    return prisma.user.update({
      where: { id },
      data: { tokenVersion: { increment: 1 } },
    });
  },

  findLeaderByPurokId(purokId: string) {
    return prisma.user.findFirst({ where: { role: "purok-leader", purokId } });
  },

  findResidentsByPurokId(purokId: string) {
    return prisma.user.findMany({
      where: { role: "resident", household: { purokId } },
      include: { household: true },
      orderBy: { username: "asc" },
    });
  },

  findByHouseholdId(householdId: string) {
    return prisma.user.findFirst({ where: { role: "resident", householdId } });
  },

  updateAccount(id: number, data: { username?: string; email?: string; name?: string }) {
    return prisma.user.update({ where: { id }, data });
  },
};
