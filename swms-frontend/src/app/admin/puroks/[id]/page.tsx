"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Mail, ShieldCheck, Users, Archive, ArchiveRestore, Trash2, Clock } from "lucide-react";
import { Card, PageHeader } from "@/components/ui/Primitives";
import { AsyncSection } from "@/components/ui/AsyncSection";
import { Modal } from "@/components/ui/Modal";
import { EditPurokDialog } from "@/components/puroks/EditPurokDialog";
import { useApi } from "@/hooks/useApi";
import { api, ApiError } from "@/lib/api";

const RESTORE_WINDOW_DAYS = 30;

function daysSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
}

export default function PurokDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const [confirmAction, setConfirmAction] = useState<"archive" | "restore" | "delete" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const query = useApi(
    () =>
      Promise.all([api.puroks(), api.archivedPuroks(), api.purokAccounts(id)]).then(
        ([active, archived, accounts]) => ({
          purok: [...active, ...archived].find((p) => p.id === id),
          accounts,
        }),
      ),
    [id],
  );

  async function runAction() {
    if (!confirmAction) return;
    setSubmitting(true);
    setActionError(null);
    try {
      if (confirmAction === "archive") await api.archivePurok(id);
      if (confirmAction === "restore") await api.restorePurok(id);
      if (confirmAction === "delete") {
        await api.deletePurokPermanently(id);
        router.push("/admin/puroks");
        return;
      }
      setConfirmAction(null);
      query.reload();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <Link href="/admin/puroks" className="flex items-center gap-1.5 text-xs font-medium text-ink/50 hover:text-pine-dark">
        <ArrowLeft size={13} /> Back to puroks
      </Link>

      <AsyncSection query={query}>
        {({ purok, accounts }) => {
          const archivedDays = purok?.archivedAt ? daysSince(purok.archivedAt) : null;
          const canRestore = archivedDays !== null && archivedDays <= RESTORE_WINDOW_DAYS;
          const canPermanentlyDelete = archivedDays !== null && archivedDays > RESTORE_WINDOW_DAYS && (purok?.households ?? 0) === 0;

          return (
            <>
              <PageHeader
                eyebrow={purok ? `${purok.households} households` : ""}
                title={purok?.name ?? "Purok"}
                description={`Login accounts registered under ${purok?.name ?? "this purok"}.`}
                actions={
                  purok && (
                    <div className="flex items-center gap-2">
                      <EditPurokDialog
                        purok={purok}
                        leaderUsername={accounts.leader?.username ?? ""}
                        leaderEmail={accounts.leader?.email ?? ""}
                        onUpdated={() => query.reload()}
                      />
                      {!purok.archivedAt ? (
                        <button
                          type="button"
                          onClick={() => setConfirmAction("archive")}
                          className="flex items-center gap-2 rounded-lg border border-line bg-paper px-3.5 py-2 text-[13px] font-medium text-ink/70 hover:border-clay/40 hover:text-clay"
                        >
                          <Archive size={14} /> Archive
                        </button>
                      ) : (
                        <>
                          {canRestore && (
                            <button
                              type="button"
                              onClick={() => setConfirmAction("restore")}
                              className="flex items-center gap-2 rounded-lg border border-line bg-paper px-3.5 py-2 text-[13px] font-medium text-ink/70 hover:border-pine/40"
                            >
                              <ArchiveRestore size={14} /> Restore
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => canPermanentlyDelete && setConfirmAction("delete")}
                            disabled={!canPermanentlyDelete}
                            title={
                              !canPermanentlyDelete
                                ? archivedDays !== null && archivedDays <= RESTORE_WINDOW_DAYS
                                  ? `Still within the ${RESTORE_WINDOW_DAYS}-day restore window.`
                                  : "This purok still has households and cannot be permanently deleted."
                                : undefined
                            }
                            className="flex items-center gap-2 rounded-lg border border-line bg-paper px-3.5 py-2 text-[13px] font-medium text-clay disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <Trash2 size={14} /> Permanently delete
                          </button>
                        </>
                      )}
                    </div>
                  )
                }
              />

              {purok?.archivedAt && (
                <div className="mb-4 flex items-start gap-2.5 rounded-2xl border border-dashed border-clay/30 bg-clay-tint/40 p-4 text-sm text-ink/70">
                  <Clock size={15} className="mt-0.5 shrink-0 text-clay" />
                  <p>
                    Archived {archivedDays} day{archivedDays === 1 ? "" : "s"} ago.{" "}
                    {canRestore
                      ? `Restorable for ${RESTORE_WINDOW_DAYS - (archivedDays ?? 0)} more day${RESTORE_WINDOW_DAYS - (archivedDays ?? 0) === 1 ? "" : "s"}.`
                      : "The 30-day restore window has passed."}{" "}
                    All historical households, trash logs, payments, and violations remain fully intact.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                <Card className="p-5">
                  <p className="text-sm font-semibold text-ink">Purok leader</p>
                  {accounts.leader ? (
                    <div className="mt-3 space-y-2.5 text-sm text-ink/70">
                      <p className="flex items-center gap-2">
                        <ShieldCheck size={14} className="text-ink/40" /> {accounts.leader.name}
                        <span className="stamp text-[10px] text-ink/40">@{accounts.leader.username}</span>
                      </p>
                      <p className="flex items-center gap-2">
                        <Mail size={14} className="text-ink/40" /> {accounts.leader.email}
                      </p>
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-ink/40">No leader account on file.</p>
                  )}
                </Card>

                <Card className="p-5 xl:col-span-2">
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                    <Users size={14} className="text-ink/40" /> Resident accounts
                  </p>
                  <p className="text-xs text-ink/50">Every resident login account belonging to a household in this purok.</p>
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="stamp text-[10.5px] text-ink/40">
                          <th className="px-2 py-2 font-medium">Username</th>
                          <th className="px-2 py-2 font-medium">Name</th>
                          <th className="px-2 py-2 font-medium">Email</th>
                          <th className="px-2 py-2 font-medium">Household</th>
                        </tr>
                      </thead>
                      <tbody>
                        {accounts.residents.map((r) => (
                          <tr key={r.id} className="ledger-row">
                            <td className="px-2 py-2.5">{r.username}</td>
                            <td className="px-2 py-2.5 text-ink/70">{r.name}</td>
                            <td className="px-2 py-2.5 text-ink/50">{r.email}</td>
                            <td className="px-2 py-2.5 text-ink/50">{r.householdCode ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {accounts.residents.length === 0 && (
                      <p className="py-6 text-center text-sm text-ink/40">No resident accounts yet.</p>
                    )}
                  </div>
                </Card>
              </div>

              <Modal
                open={confirmAction !== null}
                onClose={() => {
                  if (submitting) return;
                  setConfirmAction(null);
                  setActionError(null);
                }}
                title={
                  confirmAction === "archive"
                    ? "Archive this purok?"
                    : confirmAction === "restore"
                      ? "Restore this purok?"
                      : "Permanently delete this purok?"
                }
                description={
                  confirmAction === "archive"
                    ? "Its households, residents, and history stay intact. You can restore it within 30 days."
                    : confirmAction === "restore"
                      ? "The purok leader's access will be restored immediately."
                      : "This cannot be undone. Only allowed because no households currently reference this purok."
                }
              >
                <div className="space-y-3">
                  {actionError && (
                    <p className="rounded-lg border border-clay/30 bg-clay-tint px-3 py-2 text-xs text-clay">{actionError}</p>
                  )}
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmAction(null)}
                      disabled={submitting}
                      className="rounded-lg border border-line bg-paper px-3.5 py-2 text-[13px] font-medium text-ink/70 hover:border-pine/40"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={runAction}
                      disabled={submitting}
                      className={`rounded-lg px-3.5 py-2 text-[13px] font-semibold text-white disabled:opacity-50 ${
                        confirmAction === "delete" ? "bg-clay hover:bg-clay/90" : "bg-pine hover:bg-pine-dark"
                      }`}
                    >
                      {submitting ? "Working…" : "Confirm"}
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
