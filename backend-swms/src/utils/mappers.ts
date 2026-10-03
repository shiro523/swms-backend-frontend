// Map Prisma result rows to the exact shapes the frontend TypeScript types
// expect (see swms-frontend/src/lib/types.ts). Keeping this mapping here means
// the frontend types never have to change.

// @db.Date columns come back from Prisma as a Date at UTC midnight; format
// back to "YYYY-MM-DD" via the UTC parts so we don't shift across timezones.
function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function mapPurok(p: any) {
  return {
    id: p.id,
    name: p.name,
    leader: p.leaderName,
    households: Number(p._count?.households ?? 0),
    complianceRate: Number(p.complianceRate),
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

export function mapHousehold(h: any) {
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
    complianceRate: Number(h.complianceRate),
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
