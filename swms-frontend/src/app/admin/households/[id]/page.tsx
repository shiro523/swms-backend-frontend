"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Phone, MapPin, CalendarDays, RotateCcw, Loader2, Trash2, ShieldCheck, Mail } from "lucide-react";
import { useState } from "react";
import { Card, PageHeader } from "@/components/ui/Primitives";
import { AsyncSection } from "@/components/ui/AsyncSection";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Modal } from "@/components/ui/Modal";
import { EditHouseholdDialog } from "@/components/households/EditHouseholdDialog";
import { RecordPaymentDialog } from "@/components/households/RecordPaymentDialog";
import { QrSticker } from "@/app/resident/qr-code/QrSticker";
import { useApi } from "@/hooks/useApi";
import { api, ApiError } from "@/lib/api";
import { summarizeTrashLogs } from "@/lib/wasteMonitoring";
import { restoreWindow, toPhDate } from "@/lib/dateTime";


export default function HouseholdDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;
  const [restoring, setRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function restoreHousehold() {
    setRestoring(true);
    setRestoreError(null);
    try {
      await api.restoreHousehold(id);
      setConfirmRestore(false);
      query.reload();
    } catch (err) {
      setRestoreError(err instanceof ApiError ? err.message : "Could not restore household.");
    } finally {
      setRestoring(false);
    }
  }

  async function permanentlyDelete() {
    setDeleting(true);
    setDeleteError(null);
    try {
      await api.deleteHouseholdPermanently(id);
      router.push("/admin/households");
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : "Could not permanently delete this household.");
      setDeleting(false);
    }
  }

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
      <Link href="/admin/households" className="flex items-center gap-1.5 text-xs font-medium text-ink/50 hover:text-pine-dark">
        <ArrowLeft size={13} /> Back to households
      </Link>

      <AsyncSection query={query}>
        {({ household, payments, logs, violations }) => {
          // Exact-time window, same rule as the server's restore check.
          const recovery = household.removedAt ? restoreWindow(household.removedAt) : null;
          const canRestore = recovery?.canRestore ?? false;
          const recoveryDeadline = recovery?.deadlineDate ?? null;
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
                  {/* A removed household owes nothing this period — show its
                      removed state instead of a misleading "Unpaid". */}
                  <StatusBadge status={household.removedAt ? "removed" : household.periodPaymentStatus} />
                  {household.removedAt ? (
                    <>
                      {canRestore && (
                        <button
                          type="button"
                          onClick={() => setConfirmRestore(true)}
                          className="flex items-center gap-2 rounded-lg bg-pine px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-pine-dark disabled:opacity-50"
                        >
                          <RotateCcw size={14} /> Restore household
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(true)}
                        className="flex items-center gap-2 rounded-lg border border-clay/30 bg-paper px-3.5 py-2 text-[13px] font-medium text-clay hover:bg-clay-tint"
                      >
                        <Trash2 size={14} /> Permanently delete
                      </button>
                    </>
                  ) : (
                    <>
                      <RecordPaymentDialog householdId={household.id} onRecorded={() => query.reload()} />
                      <EditHouseholdDialog household={household} onUpdated={() => query.reload()} />
                    </>
                  )}
                </div>
              }
            />

            {household.removedAt && (
              <div className="mb-4 rounded-xl border border-clay/30 bg-clay-tint px-4 py-3 text-sm text-clay">
                Removed on {toPhDate(household.removedAt)}
                {household.removedByName ? ` by ${household.removedByName}` : ""}
                {household.removalReason ? ` — ${household.removalReason}` : ""}.{" "}
                {canRestore
                  ? `Recovery until ${recoveryDeadline} — restore to make it active again.`
                  : "The 30-day recovery window has passed; this household can no longer be restored, only permanently deleted."}{" "}
                Historical records below are preserved either way.
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
              <div className="space-y-4">
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

                <QrSticker household={household} />
              </div>

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

            <Modal
              open={confirmRestore}
              onClose={() => {
                if (restoring) return;
                setConfirmRestore(false);
                setRestoreError(null);
              }}
              title="Restore this household?"
              description="This ends the current removal state and makes the household active again: it reappears in its purok leader's active list, and its resident account can log in and use the system again."
            >
              <div className="space-y-3">
                {restoreError && (
                  <p className="rounded-lg border border-clay/30 bg-clay-tint px-3 py-2 text-xs text-clay">{restoreError}</p>
                )}
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmRestore(false)}
                    disabled={restoring}
                    className="rounded-lg border border-line bg-paper px-3.5 py-2 text-[13px] font-medium text-ink/70 hover:border-pine/40"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={restoreHousehold}
                    disabled={restoring}
                    className="flex items-center gap-2 rounded-lg bg-pine px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-pine-dark disabled:opacity-50"
                  >
                    {restoring ? <><Loader2 size={14} className="animate-spin" /> Restoring…</> : "Confirm restore"}
                  </button>
                </div>
              </div>
            </Modal>

            <Modal
              open={confirmDelete}
              onClose={() => {
                if (deleting) return;
                setConfirmDelete(false);
                setDeleteError(null);
              }}
              title="Permanently delete this household?"
              description="This cannot be undone. The household, its resident login account, family members, trash logs, violations, payments, and any notifications targeted at it will all be permanently deleted."
            >
              <div className="space-y-3">
                <p className="rounded-lg border border-clay/30 bg-clay-tint px-3 py-2 text-xs text-clay">
                  {household.code} — {household.representative}: this is a permanent, irreversible action. Only
                  proceed if you are certain this household&apos;s data should no longer exist.
                </p>
                {deleteError && (
                  <p className="rounded-lg border border-clay/30 bg-clay-tint px-3 py-2 text-xs text-clay">{deleteError}</p>
                )}
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    disabled={deleting}
                    className="rounded-lg border border-line bg-paper px-3.5 py-2 text-[13px] font-medium text-ink/70 hover:border-pine/40"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={permanentlyDelete}
                    disabled={deleting}
                    className="flex items-center gap-2 rounded-lg bg-clay px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-clay/90 disabled:opacity-50"
                  >
                    {deleting ? <><Loader2 size={14} className="animate-spin" /> Deleting…</> : "Yes, permanently delete"}
                  </button>
                </div>
              </div>
            </Modal>
          </>
          );
        }}
      </AsyncSection>
    </div>
  );
}
