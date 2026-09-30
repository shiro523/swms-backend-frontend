"use client";

import { useState } from "react";
import { Send, Loader2 } from "lucide-react";
import { PageHeader, Card } from "@/components/ui/Primitives";
import { AsyncSection } from "@/components/ui/AsyncSection";
import { Modal } from "@/components/ui/Modal";
import { NotificationList } from "@/components/notifications/NotificationList";
import { useApi } from "@/hooks/useApi";
import { api, ApiError } from "@/lib/api";
import type { NotificationItem } from "@/lib/types";

type RecipientMode = "all" | "purok" | "household";

export default function AdminNotificationsPage() {
  const [type, setType] = useState<"collection" | "payment" | "violation">("collection");
  const [recipientMode, setRecipientMode] = useState<RecipientMode>("all");
  const [targetPurokId, setTargetPurokId] = useState("");
  const [targetHouseholdId, setTargetHouseholdId] = useState<string | null>(null);
  const [householdQuery, setHouseholdQuery] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  const [pendingDelete, setPendingDelete] = useState<NotificationItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const query = useApi(
    () =>
      Promise.all([api.notifications(), api.puroks(), api.households()]).then(
        ([notifications, puroks, households]) => ({ notifications, puroks, households }),
      ),
    [],
  );

  const resetRecipient = () => {
    setTargetPurokId("");
    setTargetHouseholdId(null);
    setHouseholdQuery("");
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await api.deleteNotification(pendingDelete.id);
      setPendingDelete(null);
      query.reload();
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : "Failed to delete notification.");
    } finally {
      setDeleting(false);
    }
  };

  const selectedHousehold = query.data?.households.find((h) => h.id === targetHouseholdId) ?? null;
  const matchingHouseholds = (() => {
    const q = householdQuery.trim().toLowerCase();
    if (!q) return [];
    return (query.data?.households ?? [])
      .filter(
        (h) =>
          h.representative.toLowerCase().includes(q) ||
          h.code.toLowerCase().includes(q) ||
          h.address.toLowerCase().includes(q) ||
          h.purokName.toLowerCase().includes(q),
      )
      .slice(0, 8);
  })();

  const canSend =
    message.trim().length > 0 &&
    !sending &&
    (recipientMode !== "purok" || targetPurokId) &&
    (recipientMode !== "household" || targetHouseholdId);

  const handleSend = async () => {
    if (!canSend) return;
    setSending(true);
    setFeedback(null);
    try {
      await api.createNotification({
        type,
        message: message.trim(),
        targetPurokId: recipientMode === "purok" ? targetPurokId : undefined,
        targetHouseholdId: recipientMode === "household" ? targetHouseholdId ?? undefined : undefined,
      });
      setMessage("");
      setFeedback({
        ok: true,
        text:
          recipientMode === "all"
            ? "Notification broadcast to all households."
            : recipientMode === "purok"
              ? `Notification sent to ${query.data?.puroks.find((p) => p.id === targetPurokId)?.name ?? "the selected purok"}.`
              : `Notification sent to ${selectedHousehold?.representative ?? "the selected household"}.`,
      });
      resetRecipient();
      query.reload();
    } catch (err) {
      setFeedback({ ok: false, text: err instanceof Error ? err.message : "Failed to send." });
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Broadcast center"
        title="Notifications"
        description="Notify residents about schedules, dues, and violations."
      />

      <AsyncSection query={query}>
        {({ notifications, puroks }) => (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <Card className="p-5 xl:col-span-1">
              <p className="text-sm font-semibold text-ink">Send a notification</p>
              <div className="mt-3 space-y-3">
                <div>
                  <label className="text-xs font-medium text-ink/50">Type</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as typeof type)}
                    className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm"
                  >
                    <option value="collection">Collection schedule</option>
                    <option value="payment">Payment due date</option>
                    <option value="violation">Violation notice</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-ink/50">Recipients</label>
                  <select
                    value={recipientMode}
                    onChange={(e) => {
                      setRecipientMode(e.target.value as RecipientMode);
                      resetRecipient();
                    }}
                    className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm"
                  >
                    <option value="all">Barangay-wide (all households)</option>
                    <option value="purok">Specific purok</option>
                    <option value="household">Specific household/resident</option>
                  </select>

                  {recipientMode === "purok" && (
                    <select
                      value={targetPurokId}
                      onChange={(e) => setTargetPurokId(e.target.value)}
                      className="mt-2 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm"
                    >
                      <option value="">Select a purok…</option>
                      {puroks.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  )}

                  {recipientMode === "household" && (
                    <div className="mt-2">
                      {selectedHousehold ? (
                        <div className="flex items-center justify-between rounded-lg border border-pine/30 bg-pine-tint/40 px-3 py-2 text-sm">
                          <div>
                            <p className="font-medium text-ink">
                              {selectedHousehold.representative} <span className="stamp text-[10px] text-ink/40">{selectedHousehold.code}</span>
                            </p>
                            <p className="text-xs text-ink/50">{selectedHousehold.purokName} · {selectedHousehold.address}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setTargetHouseholdId(null)}
                            className="text-xs font-medium text-pine-dark hover:underline"
                          >
                            Change
                          </button>
                        </div>
                      ) : (
                        <>
                          <input
                            value={householdQuery}
                            onChange={(e) => setHouseholdQuery(e.target.value)}
                            placeholder="Search by name, code, purok, or address…"
                            className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm placeholder:text-ink/35"
                          />
                          {householdQuery.trim() && (
                            <div className="mt-1 max-h-44 overflow-y-auto rounded-lg border border-line">
                              {matchingHouseholds.length === 0 ? (
                                <p className="px-3 py-2 text-xs text-ink/40">No matching households.</p>
                              ) : (
                                matchingHouseholds.map((h) => (
                                  <button
                                    key={h.id}
                                    type="button"
                                    onClick={() => {
                                      setTargetHouseholdId(h.id);
                                      setHouseholdQuery("");
                                    }}
                                    className="block w-full border-b border-line px-3 py-2 text-left text-sm last:border-b-0 hover:bg-panel/50"
                                  >
                                    <p className="font-medium text-ink">
                                      {h.representative} <span className="stamp text-[10px] text-ink/40">{h.code}</span>
                                    </p>
                                    <p className="text-xs text-ink/50">{h.purokName} · {h.address}</p>
                                  </button>
                                ))
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
                <div>
                  <label className="text-xs font-medium text-ink/50">Message</label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={4}
                    placeholder="e.g. Collection for your purok is scheduled tomorrow at 6:00 AM."
                    className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm placeholder:text-ink/35"
                  />
                </div>
                <button
                  disabled={!canSend}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-pine px-3.5 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-pine-dark disabled:opacity-40"
                  onClick={handleSend}
                >
                  {sending ? <><Loader2 size={14} className="animate-spin" /> Sending…</> : <><Send size={14} /> Send notification</>}
                </button>
                {feedback && (
                  <p className={`text-[11px] ${feedback.ok ? "text-pine-dark" : "text-clay"}`}>{feedback.text}</p>
                )}
              </div>
            </Card>

            <div className="xl:col-span-2">
              <NotificationList items={notifications} onDeleteRequest={(item) => setPendingDelete(item)} />
            </div>
          </div>
        )}
      </AsyncSection>

      <Modal
        open={pendingDelete !== null}
        onClose={() => {
          if (deleting) return;
          setPendingDelete(null);
          setDeleteError(null);
        }}
        title="Delete this notification?"
        description="This permanently removes it for every recipient — residents, purok leaders, and admins. This cannot be undone."
      >
        <div className="space-y-3">
          {pendingDelete && (
            <div className="rounded-lg border border-line bg-panel/40 px-3 py-2 text-sm">
              <p className="font-medium text-ink">{pendingDelete.title}</p>
              <p className="mt-0.5 text-ink/60">{pendingDelete.message}</p>
            </div>
          )}
          {deleteError && (
            <p className="rounded-lg border border-clay/30 bg-clay-tint px-3 py-2 text-xs text-clay">{deleteError}</p>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setPendingDelete(null)}
              disabled={deleting}
              className="rounded-lg border border-line bg-paper px-3.5 py-2 text-[13px] font-medium text-ink/70 hover:border-pine/40"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="rounded-lg bg-clay px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-clay/90 disabled:opacity-50"
            >
              {deleting ? "Deleting…" : "Delete"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
