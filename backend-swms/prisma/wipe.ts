// Wipes every purok/household/activity record and every non-admin login
// account, leaving a single fresh admin account to sign in with. Usage:
// npm run db:wipe
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";
import { assertDestructiveOpsAllowed } from "./guardDestructiveOp";

const ADMIN = {
  username: "reyinoc",
  password: "12345678",
  email: "jemarleeamoin+admin@gmail.com",
  name: "Rey Inoc",
};

async function wipe() {
  assertDestructiveOpsAllowed("db:wipe");

  await prisma.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe(
        `TRUNCATE users, family_members, trash_logs, violations, payments, notifications, monthly_collection_stats, payment_collection_stats, households, puroks RESTART IDENTITY CASCADE`,
      );

      const passwordHash = await bcrypt.hash(ADMIN.password, 10);
      await tx.user.create({
        data: {
          username: ADMIN.username,
          passwordHash,
          email: ADMIN.email,
          role: "admin",
          name: ADMIN.name,
        },
      });

      console.log("Wipe complete. Everything is gone except one admin account:");
      console.log(`  ${ADMIN.username} / ${ADMIN.password} / ${ADMIN.email}`);
    },
    { timeout: 30000 },
  );
}

wipe()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error("Wipe failed:", err.message);
    await prisma.$disconnect();
    process.exit(1);
  });
