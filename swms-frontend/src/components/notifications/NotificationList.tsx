"use client";

import { useState } from "react";
import { Truck, Wallet, AlertTriangle, Trash2, ChevronRight, CalendarDays, Users } from "lucide-react";
import { Card } from "@/components/ui/Primitives";
import { Modal } from "@/components/ui/Modal";
import { NotificationItem } from "@/lib/types";
import { api } from "@/lib/api";
import clsx from "clsx";

const TYPE_META = {
  collection: { icon: Truck, tone: "bg-pine-tint text-pine-dark", label: "Collection" },
  payment: { icon: Wallet, tone: "bg-azure-tint text-azure", label: "Payment" },
  violation: { icon: AlertTriangle, tone: "bg-clay-tint text-clay", label: "Violation" },
} as const;

// Fired after a notification is marked read, so the topbar's unread dot
// updates right away instead of on the next route change.
export const NOTIFICATIONS_READ_EVENT = "swms:notifications-read";

// "2026-10-03" -> "Saturday, October 3, 2026" (parsed as a local calendar
// date, never through UTC, so it can't shift by a day).
function formatLongDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) return isoDate;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function audienceLabel(n: NotificationItem): string {
  if (n.targetHouseholdCode) return `Household ${n.targetHouseholdCode}`;
  if (n.targetPurokName) return n.leaderOnly ? `${n.targetPurokName} · leaders only` : n.targetPurokName;
  return "All households";
}

// onDeleteRequest is optional and admin-only in practice — Purok Leader and
// Resident call this component without it, so they get no delete
// affordance at all.
export function NotificationList({
  items,
  onDeleteRequest,
}: {
  items: NotificationItem[];
  onDeleteRequest?: (item: NotificationItem) => void;
}) {
  const [read, setRead] = useState<Record<string, boolean>>(
    Object.fromEntries(items.map((n) => [n.id, n.read]))
  );
  const [openItem, setOpenItem] = useState<NotificationItem | null>(null);

  // Only flip the local "read" dot after the backend confirms the change —
  // on failure we leave it exactly as it was rather than showing a read
  // state that didn't actually persist.
  const markRead = async (id: string) => {
    if (read[id]) return;
    try {
      await api.markNotificationRead(id);
      setRead((r) => ({ ...r, [id]: true }));
      window.dispatchEvent(new Event(NOTIFICATIONS_READ_EVENT));
    } catch {
      // Safe no-op — notification stays visually unread so the user can retry.
    }
  };

  const open = (n: NotificationItem) => {
    setOpenItem(n);
    void markRead(n.id);
  };

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-line py-16 text-center text-sm text-ink/40">
        No notifications yet.
      </div>
    );
  }

  const openMeta = openItem ? TYPE_META[openItem.type] : null;

  return (
    <>
      <Card>
        <div className="divide-y divide-line">
          {items.map((n) => {
            const meta = TYPE_META[n.type];
            const Icon = meta.icon;
            const isRead = read[n.id];
            return (
              <div
                key={n.id}
                className={clsx(
                  "group flex w-full items-start gap-3 px-4 py-4 transition-colors hover:bg-panel/60",
                  !isRead && "bg-pine-tint/20"
                )}
              >
                <button
                  type="button"
                  onClick={() => open(n)}
                  className="flex min-w-0 flex-1 cursor-pointer items-start gap-3 text-left"
                  aria-label={`Open notification: ${n.title}`}
                >
                  <span className={clsx("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", meta.tone)}>
                    <Icon size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className={clsx("text-sm text-ink", isRead ? "font-medium" : "font-semibold")}>{n.title}</p>
                      {!isRead && <span className="h-1.5 w-1.5 rounded-full bg-clay" aria-label="Unread" />}
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-sm text-ink/60">{n.message}</p>
                    <p className="stamp mt-1.5 text-[10px] text-ink/35">
                      {n.date} · {audienceLabel(n)}
                    </p>
                  </div>
                  <ChevronRight
                    size={16}
                    className="mt-2.5 shrink-0 text-ink/25 transition-colors group-hover:text-pine"
                    aria-hidden
                  />
                </button>
                {onDeleteRequest && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteRequest(n);
                    }}
                    aria-label="Delete notification"
                    className="mt-1 shrink-0 rounded-lg p-1.5 text-ink/35 hover:bg-clay-tint hover:text-clay"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      <Modal
        open={openItem !== null}
        onClose={() => setOpenItem(null)}
        title={openItem?.title ?? ""}
        widthClassName="max-w-lg"
      >
        {openItem && openMeta && (
          <div>
            <div className="flex items-center gap-2">
              <span className={clsx("flex h-8 w-8 items-center justify-center rounded-lg", openMeta.tone)}>
                <openMeta.icon size={15} />
              </span>
              <span className={clsx("rounded-full px-2.5 py-0.5 text-[11px] font-medium", openMeta.tone)}>
                {openMeta.label}
              </span>
            </div>

            <p className="mt-4 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-ink">
              {openItem.message}
            </p>

            <div className="mt-5 space-y-2 rounded-xl border border-line bg-panel/50 px-4 py-3 text-sm text-ink/65">
              <p className="flex items-center gap-2">
                <CalendarDays size={14} className="shrink-0 text-ink/40" /> {formatLongDate(openItem.date)}
              </p>
              <p className="flex items-center gap-2">
                <Users size={14} className="shrink-0 text-ink/40" /> Sent to: {audienceLabel(openItem)}
              </p>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setOpenItem(null)}
                className="rounded-xl bg-pine px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-pine-dark"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
