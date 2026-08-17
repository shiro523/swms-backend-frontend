import bcrypt from "bcryptjs";
import { randomBytes, createHash } from "crypto";
import { userRepository } from "@/repositories/user.repository";
import { mapUser } from "@/utils/mappers";
import { HttpError } from "@/middlewares/error.middleware";
import { sendPasswordResetEmail } from "@/lib/mailer";
import { config } from "@/config/env";

// Compare against a dummy hash when the user is missing so response timing
// doesn't reveal whether the username exists.
const DUMMY_HASH = "$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidiu";

const RESET_TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export const authService = {
  async login(username: string, password: string) {
    const user = await userRepository.findByUsername(username);
    const hash = user?.passwordHash ?? DUMMY_HASH;
    const ok = await bcrypt.compare(password, hash);
    if (!user || !ok) {
      throw new HttpError(401, "Invalid username or password.");
    }
    return mapUser(user);
  },

  async me(id: number) {
    const user = await userRepository.findById(id);
    return user ? mapUser(user) : null;
  },

  // Always succeeds from the caller's point of view — never reveals whether
  // an account with that email exists.
  async forgotPassword(email: string) {
    const user = await userRepository.findByEmail(email);
    if (!user) return;

    const rawToken = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);
    await userRepository.setResetToken(user.id, hashToken(rawToken), expiresAt);

    const resetUrl = `${config.frontendOrigin}/reset-password/${rawToken}`;
    await sendPasswordResetEmail(email, resetUrl);
  },

  async resetPassword(token: string, newPassword: string) {
    const user = await userRepository.findByValidResetToken(hashToken(token));
    if (!user) {
      throw new HttpError(400, "This reset link is invalid or has expired.");
    }
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await userRepository.updatePasswordAndClearReset(user.id, passwordHash);
  },
};
