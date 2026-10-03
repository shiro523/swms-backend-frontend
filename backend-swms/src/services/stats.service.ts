import { statsRepository } from "@/repositories/stats.repository";
import { settingsRepository } from "@/repositories/settings.repository";
import { householdRelationScopeWhere } from "@/utils/scope";
import { getDbToday } from "@/lib/dbTime";
import type { AuthContext } from "@/lib/token";

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WINDOW_MONTHS = 6;

function monthKey(d: Date) {
  return `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
}

// The trailing WINDOW_MONTHS calendar months, oldest first, ending with the
// month `today` falls in.
function monthWindow(today: Date) {
  return Array.from({ length: WINDOW_MONTHS }, (_, i) => {
    const offset = WINDOW_MONTHS - 1 - i;
    const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - offset, 1));
    return { key: monthKey(start), label: MONTH_ABBR[start.getUTCMonth()], start };
  });
}

export const statsService = {
  // Compliant/violation/missed trash-log counts per month, scoped the same
  // way every other household-relation resource is scoped (admin: all,
  // purok-leader: their purok, resident: their own household).
  async monthlyCollection(user: AuthContext) {
    const today = await getDbToday();
    const months = monthWindow(today);
    const rows = await statsRepository.trashLogsSince(householdRelationScopeWhere(user), months[0].start);

    const buckets = new Map(months.map((m) => [m.key, { compliant: 0, violations: 0, missed: 0 }]));
    for (const row of rows) {
      const bucket = buckets.get(monthKey(row.logDate));
      if (!bucket) continue;
      if (row.status === "compliant") bucket.compliant++;
      else if (row.status === "violation") bucket.violations++;
      else if (row.status === "missed") bucket.missed++;
    }

    return months.map((m) => ({ month: m.label, ...buckets.get(m.key)! }));
  },

  // Amount actually collected per month, same scoping as above. `target` is
  // the standard configured fee times the number of distinct households that
  // actually paid that month — i.e. "did paying households pay the
  // configured rate," not "did every household in scope pay" (that separate,
  // already-answered question is what current-period paid/unpaid tracking on
  // the Payments pages is for — see paymentPeriod.ts on the frontend). Before
  // Batch F, Admin Settings' fee was a disconnected placeholder with no real
  // value to multiply by, so `target` was reported as null rather than a
  // fabricated number; now that the fee is real, this is that same
  // pre-identified integration point, using the real configured value.
  async paymentCollection(user: AuthContext) {
    const today = await getDbToday();
    const months = monthWindow(today);
    const rows = await statsRepository.paidPaymentsSince(householdRelationScopeWhere(user), months[0].start);
    const settings = await settingsRepository.get();
    const fee = Number(settings.monthlyCollectionFee);

    const collected = new Map(months.map((m) => [m.key, 0]));
    const payingHouseholds = new Map(months.map((m) => [m.key, new Set<string>()]));
    for (const row of rows) {
      if (!row.datePaid) continue;
      const key = monthKey(row.datePaid);
      if (!collected.has(key)) continue;
      collected.set(key, collected.get(key)! + Number(row.amount));
      payingHouseholds.get(key)!.add(row.householdId);
    }

    return months.map((m) => ({
      month: m.label,
      collected: collected.get(m.key)!,
      target: fee > 0 ? payingHouseholds.get(m.key)!.size * fee : null,
    }));
  },
};
