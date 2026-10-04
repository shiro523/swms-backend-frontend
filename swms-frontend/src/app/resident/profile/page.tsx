"use client";

import { Mail, Phone, MapPin, CalendarDays, Users } from "lucide-react";
import { Card, PageHeader, EmptyState } from "@/components/ui/Primitives";
import { AsyncSection } from "@/components/ui/AsyncSection";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ProfileEditor } from "./ProfileEditor";
import { EditPersonalInfoDialog } from "./EditPersonalInfoDialog";
import { useApi } from "@/hooks/useApi";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { summarizeTrashLogs } from "@/lib/wasteMonitoring";
import { toPhDate, toPhDateOrDash } from "@/lib/dateTime";

export default function ResidentProfilePage() {
  const { refresh: refreshSession } = useAuth();
  const query = useApi(
    () =>
      Promise.all([
        api.households().then((h) => h[0]),
        api.payments(),
        api.trashLogs(),
        api.violations(),
      ]).then(([household, payments, logs, violations]) => ({ household, payments, logs, violations })),
    [],
  );

  return (
    <AsyncSection query={query}>
      {({ household, payments, logs, violations }) => {
        // api.households() is correctly scoped to this resident's own
        // household (see householdScopeWhere's resident case), but that
        // scope resolves via user.householdId — nullable in the schema —
        // so it can legitimately return zero rows for an account with no
        // linked household (e.g. one left behind by a data-repair path
        // that didn't go through the household/resident deletion order
        // this app's own permanent-delete flow enforces). That is a real,
        // if rare, empty case, not a bug in the query itself, so it gets a
        // real empty state rather than crashing on household.* below.
        if (!household) {
          return (
            <EmptyState
              title="No household associated with this account."
              description="Contact your barangay administrator if you believe this is an error."
            />
          );
        }

        const accountStatus = household.removedAt ? "Removed" : "Active";
        const waste = summarizeTrashLogs(logs);

        return (
          <div>
            <PageHeader
              eyebrow={household.code}
              title={household.representative}
              description={`Resident of ${household.purokName}`}
            />

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <Card className="p-5">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-ink">Personal information</p>
                  <EditPersonalInfoDialog
                    household={household}
                    onUpdated={() => {
                      query.reload();
                      // The top bar shows the account name, which follows the
                      // representative name.
                      void refreshSession();
                    }}
                  />
                </div>
                <div className="mt-3 space-y-2.5 text-sm text-ink/70">
                  <p className="flex items-center gap-2"><Mail size={14} className="text-ink/40" /> {household.username ? `@${household.username}` : "No account"} {household.email ? `· ${household.email}` : ""}</p>
                  <p className="flex items-center gap-2"><Phone size={14} className="text-ink/40" /> {household.contactNumber}</p>
                  <p className="flex items-center gap-2"><MapPin size={14} className="text-ink/40" /> {household.address}, {household.purokName}</p>
                  <p className="flex items-center gap-2"><CalendarDays size={14} className="text-ink/40" /> Registered {household.accountCreatedAt ? toPhDate(household.accountCreatedAt) : household.registeredAt}</p>
                </div>
              </Card>

              <Card className="p-5">
                <p className="text-sm font-semibold text-ink">Account information</p>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-ink/70">
                  <div>
                    <p className="text-[10.5px] font-medium uppercase tracking-wide text-ink/45">Status</p>
                    <p className="mt-0.5"><StatusBadge status={accountStatus.toLowerCase()} /></p>
                  </div>
                  <div>
                    <p className="text-[10.5px] font-medium uppercase tracking-wide text-ink/45">Account created</p>
                    <p className="mt-0.5">{toPhDateOrDash(household.accountCreatedAt)}</p>
                  </div>
                </div>
              </Card>
            </div>

            <Card className="mt-4 p-5">
              <p className="text-sm font-semibold text-ink">Household information</p>
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm text-ink/70 sm:grid-cols-4">
                <div>
                  <p className="text-[10.5px] font-medium uppercase tracking-wide text-ink/45">Household code</p>
                  <p className="mt-0.5">{household.code}</p>
                </div>
                <div>
                  <p className="text-[10.5px] font-medium uppercase tracking-wide text-ink/45">Representative</p>
                  <p className="mt-0.5">{household.representative}</p>
                </div>
                <div>
                  <p className="text-[10.5px] font-medium uppercase tracking-wide text-ink/45">Purok</p>
                  <p className="mt-0.5">{household.purokName}</p>
                </div>
                <div>
                  <p className="text-[10.5px] font-medium uppercase tracking-wide text-ink/45">Family members</p>
                  <p className="mt-0.5 flex items-center gap-1"><Users size={13} className="text-ink/40" /> {household.members.length}</p>
                </div>
              </div>
              <p className="mt-3 flex items-center gap-2 text-sm text-ink/70"><MapPin size={14} className="text-ink/40" /> {household.address}</p>
            </Card>

            <div className="mt-4">
              <ProfileEditor household={household} onChanged={() => query.reload()} />
            </div>

            <Card className="mt-4 p-5">
              <p className="text-sm font-semibold text-ink">Waste monitoring</p>
              <p className="text-xs text-ink/50">Summary derived from your household&apos;s own trash collection logs</p>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
                <div className="rounded-xl border border-line bg-panel px-3 py-2.5">
                  <p className="text-[10.5px] font-medium uppercase tracking-wide text-ink/45">Total logs</p>
                  <p className="mt-1 font-[family-name:var(--font-display)] text-lg font-semibold text-ink">{waste.total}</p>
                </div>
                <div className="rounded-xl border border-line bg-panel px-3 py-2.5">
                  <p className="text-[10.5px] font-medium uppercase tracking-wide text-ink/45">Compliant</p>
                  <p className="mt-1 font-[family-name:var(--font-display)] text-lg font-semibold text-ink">{waste.compliant}</p>
                </div>
                <div className="rounded-xl border border-line bg-panel px-3 py-2.5">
                  <p className="text-[10.5px] font-medium uppercase tracking-wide text-ink/45">Violations</p>
                  <p className="mt-1 font-[family-name:var(--font-display)] text-lg font-semibold text-ink">{waste.violations}</p>
                </div>
                <div className="rounded-xl border border-line bg-panel px-3 py-2.5">
                  <p className="text-[10.5px] font-medium uppercase tracking-wide text-ink/45">Missed</p>
                  <p className="mt-1 font-[family-name:var(--font-display)] text-lg font-semibold text-ink">{waste.missed}</p>
                </div>
                <div className="rounded-xl border border-line bg-panel px-3 py-2.5">
                  <p className="text-[10.5px] font-medium uppercase tracking-wide text-ink/45">Most recent</p>
                  <p className="mt-1 font-[family-name:var(--font-display)] text-lg font-semibold text-ink">{waste.mostRecent?.date ?? "—"}</p>
                </div>
              </div>
              {waste.total === 0 && <p className="mt-3 text-sm text-ink/40">No trash logs recorded.</p>}
            </Card>

            <Card className="mt-4 p-5">
              <p className="text-sm font-semibold text-ink">Violations</p>
              <div className="mt-2 divide-y divide-line">
                {violations.length === 0 && <p className="py-3 text-sm text-ink/40">No violations recorded.</p>}
                {violations.map((v) => (
                  <div key={v.id} className="py-2.5 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-ink/70">{v.date} · {v.type}{v.isRepeat ? " (repeat)" : ""}</span>
                      <StatusBadge status={v.status} />
                    </div>
                    {v.notes && <p className="mt-1 text-xs text-ink/45">{v.notes}</p>}
                    {v.status === "completed" && v.resolvedByName && (
                      <p className="mt-1 text-xs text-ink/45">Resolved by {v.resolvedByName}{v.resolvedAt ? ` on ${toPhDate(v.resolvedAt)}` : ""}</p>
                    )}
                  </div>
                ))}
              </div>
            </Card>

            <Card className="mt-4 p-5">
              <p className="text-sm font-semibold text-ink">Payment information</p>
              <p className="text-xs text-ink/50">
                {payments.length === 0
                  ? "No payments recorded."
                  : `${payments.length} payment${payments.length === 1 ? "" : "s"} recorded · ₱${payments.reduce((sum, p) => sum + p.amount, 0).toFixed(2)} total`}
              </p>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="stamp text-[10.5px] text-ink/40">
                      <th className="px-2 py-2 font-medium">Period</th>
                      <th className="px-2 py-2 font-medium">Amount</th>
                      <th className="px-2 py-2 font-medium">Date paid</th>
                      <th className="px-2 py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p) => (
                      <tr key={p.id} className="ledger-row">
                        <td className="px-2 py-2.5">{p.period}</td>
                        <td className="px-2 py-2.5">₱{p.amount.toFixed(2)}</td>
                        <td className="px-2 py-2.5 text-ink/50">{p.datePaid ?? "—"}</td>
                        <td className="px-2 py-2.5"><StatusBadge status={p.status} /></td>
                      </tr>
                    ))}
                    {payments.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-2 py-4 text-center text-sm text-ink/40">No payments recorded.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        );
      }}
    </AsyncSection>
  );
}
