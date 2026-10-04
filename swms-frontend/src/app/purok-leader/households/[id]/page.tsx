"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Phone, MapPin, CalendarDays, ShieldCheck, Mail } from "lucide-react";
import { Card, PageHeader } from "@/components/ui/Primitives";
import { AsyncSection } from "@/components/ui/AsyncSection";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EditHouseholdDialog } from "@/components/households/EditHouseholdDialog";
import { RecordPaymentDialog } from "@/components/households/RecordPaymentDialog";
import { RemoveHouseholdDialog } from "@/components/households/RemoveHouseholdDialog";
import { useApi } from "@/hooks/useApi";
import { api } from "@/lib/api";
import { summarizeTrashLogs } from "@/lib/wasteMonitoring";
import { toPhDate } from "@/lib/dateTime";

export default function PurokLeaderHouseholdDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const query = useApi(
    () =>
      Promise.all([
        api.household(id),
        api.payments(id),
        api.trashLogs(id),
        api.violations(id),
      ]).then(([household, payments, logs, violations]) => ({
        household,
        payments,
        logs,
        violations,
      })),
    [id],
  );

  return (
    <div>
      <Link href="/purok-leader/households" className="flex items-center gap-1.5 text-xs font-medium text-ink/50 hover:text-pine-dark">
        <ArrowLeft size={13} /> Back to households
      </Link>

      <AsyncSection query={query}>
        {({ household, payments, logs, violations }) => {
          const accountStatus = household.removedAt ? "Removed" : "Active";
          const waste = summarizeTrashLogs(logs);

          return (
          <>
            <PageHeader
              eyebrow={household.code}
              title={household.representative}
              description={`House representative for ${household.purokName}`}
              actions={
                <div className="flex items-center gap-2">
                  {/* A removed household owes nothing this period. */}
                  <StatusBadge status={household.removedAt ? "removed" : household.periodPaymentStatus} />
                  {!household.removedAt && (
                    <>
                      <RecordPaymentDialog householdId={household.id} onRecorded={() => query.reload()} />
                      <EditHouseholdDialog household={household} onUpdated={() => query.reload()} />
                      <RemoveHouseholdDialog household={household} onRemoved={() => query.reload()} />
                    </>
                  )}
                </div>
              }
            />

            {household.removedAt && (
              <div className="mb-4 rounded-xl border border-clay/30 bg-clay-tint px-4 py-3 text-sm text-clay">
                This household was removed on {toPhDate(household.removedAt)}
                {household.removalReason ? ` — ${household.removalReason}` : ""}. It is inactive; contact an
                admin if it needs to be restored.
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
              <Card className="p-5">
                <p className="text-sm font-semibold text-ink">Personal information</p>
                <div className="mt-3 space-y-2.5 text-sm text-ink/70">
                  <p className="flex items-center gap-2"><ShieldCheck size={14} className="text-ink/40" /> {household.representative}</p>
                  <p className="flex items-center gap-2"><Mail size={14} className="text-ink/40" /> {household.username ? `@${household.username}` : "No account"} {household.email ? `· ${household.email}` : ""}</p>
                  <p className="flex items-center gap-2"><Phone size={14} className="text-ink/40" /> {household.contactNumber}</p>
                  <p className="flex items-center gap-2"><MapPin size={14} className="text-ink/40" /> {household.address}, {household.purokName}</p>
                  <p className="flex items-center gap-2"><CalendarDays size={14} className="text-ink/40" /> Registered {household.accountCreatedAt ? toPhDate(household.accountCreatedAt) : household.registeredAt}</p>
                </div>

                <p className="mt-5 text-sm font-semibold text-ink">Account information</p>
                <div className="mt-2 grid grid-cols-2 gap-2 text-sm text-ink/70">
                  <div>
                    <p className="text-[10.5px] font-medium uppercase tracking-wide text-ink/45">Role</p>
                    <p className="mt-0.5">Resident</p>
                  </div>
                  <div>
                    <p className="text-[10.5px] font-medium uppercase tracking-wide text-ink/45">Status</p>
                    <p className="mt-0.5"><StatusBadge status={accountStatus.toLowerCase()} /></p>
                  </div>
                </div>

                <p className="mt-5 text-sm font-semibold text-ink">Household information</p>
                <div className="mt-2 grid grid-cols-2 gap-2 text-sm text-ink/70">
                  <div>
                    <p className="text-[10.5px] font-medium uppercase tracking-wide text-ink/45">Household code</p>
                    <p className="mt-0.5">{household.code}</p>
                  </div>
                  <div>
                    <p className="text-[10.5px] font-medium uppercase tracking-wide text-ink/45">Family members</p>
                    <p className="mt-0.5">{household.members.length}</p>
                  </div>
                </div>

                <p className="mt-5 text-sm font-semibold text-ink">Family members</p>
                <div className="mt-2 divide-y divide-line">
                  {household.members.length === 0 && <p className="py-2 text-sm text-ink/40">No family members recorded.</p>}
                  {household.members.map((m) => (
                    <div key={m.id} className="flex items-center justify-between py-2 text-sm">
                      <span className="text-ink/80">{m.name}</span>
                      <span className="text-xs text-ink/45">{m.relation} · {m.age} y/o</span>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="p-5 xl:col-span-2">
                <p className="text-sm font-semibold text-ink">Waste monitoring</p>
                <p className="text-xs text-ink/50">Summary derived from this household&apos;s own trash collection logs</p>
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

                <p className="mt-6 text-sm font-semibold text-ink">Trash collection logs</p>
                <div className="mt-2 divide-y divide-line">
                  {logs.length === 0 && <p className="py-3 text-sm text-ink/40">No collection logs yet.</p>}
                  {logs.map((log) => (
                    <div key={log.id} className="flex items-center justify-between py-2.5 text-sm">
                      <span className="text-ink/70">{log.date} · {log.time} · {log.collector}</span>
                      <StatusBadge status={log.status} />
                    </div>
                  ))}
                </div>

                <p className="mt-6 text-sm font-semibold text-ink">Violations</p>
                <div className="mt-2 divide-y divide-line">
                  {violations.length === 0 && <p className="py-3 text-sm text-ink/40">No violations on record.</p>}
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

                <p className="mt-6 text-sm font-semibold text-ink">Payment information</p>
                <p className="text-xs text-ink/50">
                  {payments.length} payment{payments.length === 1 ? "" : "s"} recorded · ₱{payments.reduce((sum, p) => sum + p.amount, 0).toFixed(2)} total
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
          </>
          );
        }}
      </AsyncSection>
    </div>
  );
}
