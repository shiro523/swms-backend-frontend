import { randomUUID } from "node:crypto";

// Every synthetic record created by the fixture helpers carries this run ID
// somewhere in its identifying field (username, or a `test-p-<runId>` /
// `test-hh-<runId>-<seq>` primary key) so cleanupTestRun() can find exactly
// — and only — what one test run created.
export function newTestRunId(): string {
  return randomUUID().slice(0, 8);
}

export const TEST_USERNAME_PREFIX = "test-";

export function testUsername(runId: string, label: string, seq = 1): string {
  return `${TEST_USERNAME_PREFIX}${runId}-${label}-${seq}`;
}

// The .invalid TLD is reserved by RFC 2606 specifically for addresses that
// must never resolve or be deliverable — guarantees a fixture's email can
// never collide with, or accidentally reach, a real inbox.
export function testEmail(runId: string, label: string, seq = 1): string {
  return `${testUsername(runId, label, seq)}@example-test.invalid`;
}

export function testPurokId(runId: string): string {
  return `test-p-${runId}`;
}

export function testHouseholdId(runId: string, seq = 1): string {
  return `test-hh-${runId}-${seq}`;
}
