"use client";

import { useState } from "react";
import { Send, Loader2 } from "lucide-react";
import { PageHeader, Card } from "@/components/ui/Primitives";
import { AsyncSection } from "@/components/ui/AsyncSection";
import { NotificationList } from "@/components/notifications/NotificationList";
import { useApi } from "@/hooks/useApi";
import { api } from "@/lib/api";

export default function AdminNotificationsPage() {
  const [type, setType] = useState<"collection" | "payment" | "violation">("collection");
  const [target, setTarget] = useState("all");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  const query = useApi(
    () =>
      Promise.all([api.notifications(), api.puroks()]).then(([notifications, puroks]) => ({
        notifications,
        puroks,
      })),
    [],
  );

  const handleSend = async () => {
    if (!message.trim()) return;
    setSending(true);
    setFeedback(null);
    try {
      await api.createNotification({ type, message: message.trim() });
      setMessage("");
      setFeedback({ ok: true, text: "Notification broadcast." });
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
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm"
                  >
                    <option value="all">All households</option>
                    {puroks.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
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
                  disabled={!message.trim() || sending}
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
              <NotificationList items={notifications} />
            </div>
          </div>
        )}
      </AsyncSection>
    </div>
  );
}
