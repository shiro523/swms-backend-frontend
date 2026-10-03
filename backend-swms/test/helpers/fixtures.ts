// Small, composable disposable-fixture factories. Each one goes through the
// same repository layer the real application uses (purokRepository,
// householdRepository) rather than hand-rolled Prisma calls, so fixtures
// exercise the actual production create path (including its transaction
// shape) instead of a parallel, drift-prone reimplementation. The one
// exception is the plain admin account, which has no dedicated repository
// method anywhere in the app — prisma/wipe.ts creates its own admin account
// the same direct way, so this mirrors that existing precedent.
//
// Every fixture is identified by a `runId` (see ids.ts) embedded in its
// username and, for puroks/households, its primary key — that's what lets
// cleanup.ts remove exactly one run's records and nothing else.
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { purokRepository } from "@/repositories/purok.repository";
import { householdRepository } from "@/repositories/household.repository";
import { assertTestEnvironmentActive } from "./testGuard";
import { newTestRunId, testUsername, testEmail, testPurokId, testHouseholdId } from "./ids";

// A fixed, clearly-synthetic password — never a real user's credential.
// Hashed with the same bcrypt mechanism auth.service.ts/wipe.ts use in
// production, so login-flow tests exercise real password verification.
export const TEST_PASSWORD = "Test-Fixture-Pass-1!";

async function hashTestPassword(): Promise<string> {
  return bcrypt.hash(TEST_PASSWORD, 10);
}

export interface TestPurokFixture {
  runId: string;
  purokId: string;
  leaderUsername: string;
}

export async function createTestPurok(runId: string = newTestRunId()): Promise<TestPurokFixture> {
  assertTestEnvironmentActive();
  const purokId = testPurokId(runId);
  const leaderUsername = testUsername(runId, "leader");
  await purokRepository.createWithLeader({
    id: purokId,
    name: `Test Purok ${runId}`,
    leaderName: "Test Leader",
    complianceRate: 100,
    user: {
      username: leaderUsername,
      passwordHash: await hashTestPassword(),
      email: testEmail(runId, "leader"),
    },
  });
  return { runId, purokId, leaderUsername };
}

export interface TestHouseholdFixture {
  runId: string;
  purokId: string;
  householdId: string;
  residentUsername: string;
}

export async function createTestHousehold(
  purok: TestPurokFixture,
  seq = 1,
): Promise<TestHouseholdFixture> {
  assertTestEnvironmentActive();
  const householdId = testHouseholdId(purok.runId, seq);
  const residentUsername = testUsername(purok.runId, "resident", seq);
  await householdRepository.createWithMembers({
    id: householdId,
    code: `TEST-${purok.runId}-${seq}`,
    representative: `Test Representative ${seq}`,
    address: "123 Test Street",
    purokId: purok.purokId,
    contactNumber: "0900-000-0000",
    registeredAt: new Date(),
    members: [],
    user: {
      username: residentUsername,
      passwordHash: await hashTestPassword(),
      email: testEmail(purok.runId, "resident", seq),
      name: `Test Resident ${seq}`,
    },
  });
  return { runId: purok.runId, purokId: purok.purokId, householdId, residentUsername };
}

export interface TestAdminFixture {
  runId: string;
  username: string;
}

export async function createTestAdmin(runId: string = newTestRunId()): Promise<TestAdminFixture> {
  assertTestEnvironmentActive();
  const username = testUsername(runId, "admin");
  await prisma.user.create({
    data: {
      username,
      passwordHash: await hashTestPassword(),
      email: testEmail(runId, "admin"),
      role: "admin",
      name: "Test Admin",
    },
  });
  return { runId, username };
}
