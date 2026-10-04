// Map Prisma result rows to the exact shapes the frontend TypeScript types
// expect (see swms-frontend/src/lib/types.ts). Keeping this mapping here means
// the frontend types never have to change.

// @db.Date columns come back from Prisma as a Date at UTC midnight; format
// back to "YYYY-MM-DD" via the UTC parts so we don't shift across timezones.
function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function averageCompliance(households: { complianceRate: number }[]): number | null {
  if (households.length === 0) return null;
  return Math.round(households.reduce((sum, h) => sum + Number(h.complianceRate), 0) / households.length);
}

export function mapPurok(p: any) {
  const all: { removedAt: Date | null; complianceRate: number; _count?: { trashLogs: number } }[] = p.households ?? [];
  const active = all.filter((h) => h.removedAt === null);
  return {
    id: p.id,
    name: p.name,
    leader: p.leaderName,
    // Active households only; removed ones are counted separately.
    households: active.length,
    removedHouseholds: all.length - active.length,
    // Live average over active households with collection records (see
    // PUROK_INCLUDE in purok.repository.ts); null = no records yet, never a
    // made-up 100%.
    complianceRate: averageCompliance(active.filter((h) => (h._count?.trashLogs ?? 0) > 0)),
    // ISO string (or null if active) — the frontend uses this only for
    // display/countdown purposes; the actual 30-day restore/delete gates are
    // always re-checked server-side, never trusted from this value alone.
    archivedAt: p.archivedAt ? p.archivedAt.toISOString() : null,
  };
}

export function mapFamilyMember(m: any) {
  return {
    id: m.id,
    name: m.name,
    relation: m.relation,
    age: Number(m.age),
  };
}

export type PeriodPaymentStatus = "paid" | "unpaid" | "new";

// periodPaymentStatus is computed by householdService (it needs the current
// period's payments); see periodPaymentStatus() there.
export function mapHousehold(h: any, periodPaymentStatus: PeriodPaymentStatus) {
  return {
    id: h.id,
    code: h.code,
    representative: h.representative,
    address: h.address,
    purokId: h.purokId,
    purokName: h.purok?.name,
    contactNumber: h.contactNumber,
    members: (h.members ?? []).map(mapFamilyMember),
    registeredAt: formatDate(h.registeredAt),
    paymentStatus: h.paymentStatus,
    periodPaymentStatus,
    complianceRate: Number(h.complianceRate),
    // False until the first trash log — complianceRate is a placeholder
    // (100) until then and shouldn't be presented as a real record.
    hasCollectionRecords: Number(h._count?.trashLogs ?? 0) > 0,
    username: h.users?.[0]?.username ?? null,
    email: h.users?.[0]?.email ?? null,
    // The resident login account's own creation date — already fetched via
    // HOUSEHOLD_INCLUDE's `users` relation (see household.repository.ts),
    // just not previously surfaced. Never exposes passwordHash/resetTokenHash
    // or any other field from that row.
    accountCreatedAt: h.users?.[0]?.createdAt ? h.users[0].createdAt.toISOString() : null,
    removedAt: h.removedAt ? h.removedAt.toISOString() : null,
    removalReason: h.removalReason ?? null,
    removedByName: h.removedByName ?? null,
  };
}

export function mapTrashLog(t: any) {
  return {
    id: t.id,
    householdId: t.householdId,
    householdCode: t.household.code,
    representative: t.household.representative,
    purokName: t.household.purok.name,
    date: formatDate(t.logDate),
    time: t.logTime,
    collector: t.collector,
    status: t.status,
    disposedBy: t.disposedBy,
    notes: t.notes ?? undefined,
  };
}

export function mapViolation(v: any) {
  return {
    id: v.id,
    householdId: v.householdId,
    householdCode: v.household.code,
    representative: v.household.representative,
    purokName: v.household.purok.name,
    type: v.type,
    date: formatDate(v.vDate),
    isRepeat: v.isRepeat,
    notes: v.notes,
    status: v.status,
    resolvedAt: v.resolvedAt ? v.resolvedAt.toISOString() : null,
    resolvedByName: v.resolvedByName ?? null,
  };
}

export function mapPayment(p: any) {
  return {
    id: p.id,
    householdId: p.householdId,
    householdCode: p.household.code,
    representative: p.household.representative,
    purokName: p.household.purok.name,
    period: p.period,
    amount: Number(p.amount),
    status: p.status,
    datePaid: p.datePaid ? formatDate(p.datePaid) : undefined,
  };
}

export function mapNotification(n: any) {
  return {
    id: n.id,
    title: n.title,
    message: n.message,
    type: n.type,
    date: formatDate(n.nDate),
    // Per-user read state (Batch E) — `reads` is pre-filtered by the
    // repository to just the current viewer's own row, if any.
    read: (n.reads?.length ?? 0) > 0,
    targetPurokName: n.targetPurok?.name ?? null,
    targetHouseholdCode: n.targetHousehold?.code ?? null,
    // Purok alerts meant for the purok leader only — residents never see them.
    leaderOnly: Boolean(n.leaderOnly),
  };
}

export function mapUser(u: any) {
  return {
    id: u.id,
    username: u.username,
    role: u.role,
    name: u.name,
    email: u.email ?? null,
    householdId: u.householdId ?? null,
    purokId: u.purokId ?? null,
    // Needed internally by signToken(); auth.controller.ts strips this
    // before sending the user object to the client.
    tokenVersion: u.tokenVersion,
  };
}

// Lightweight account summary for the admin purok drill-down view.
export function mapAccount(u: any) {
  return {
    id: u.id,
    username: u.username,
    name: u.name,
    email: u.email,
    role: u.role,
    householdCode: u.household?.code ?? null,
    // A removed household's resident can no longer log in.
    householdRemoved: u.household?.removedAt != null,
  };
}

export function mapSettings(s: any) {
  return {
    barangayName: s.barangayName,
    municipality: s.municipality,
    contactNumber: s.contactNumber,
    monthlyCollectionFee: Number(s.monthlyCollectionFee),
    collectionDays: s.collectionDays,
    collectionTime: s.collectionTime,
    updatedAt: s.updatedAt.toISOString(),
  };
}
