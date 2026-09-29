"use client";

import { useState } from "react";
import { Truck, Wallet, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/Primitives";
import { NotificationItem } from "@/lib/types";
import { api } from "@/lib/api";
import clsx from "clsx";

const TYPE_META = {
  collection: { icon: Truck, tone: "bg-pine-tint text-pine-dark" },
  payment: { icon: Wallet, tone: "bg-azure-tint text-azure" },
  violation: { icon: AlertTriangle, tone: "bg-clay-tint text-clay" },
} as const;

export function NotificationList({ items }: { items: NotificationItem[] }) {
  const [read, setRead] = useState<Record<string, boolean>>(
    Object.fromEntries(items.map((n) => [n.id, n.read]))
  );

  // Only flip the local "read" dot after the backend confirms the change —
  // on failure we leave it exactly as it was rather than showing a read
  // state that didn't actually persist.
  const markRead = async (id: string) => {
    if (read[id]) return;
    try {
      await api.markNotificationRead(id);
      setRead((r) => ({ ...r, [id]: true }));
    } catch {
      // Safe no-op — notification stays visually unread so the user can retry.
    }
  };

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-line py-16 text-center text-sm text-ink/40">
        No notifications yet.
      </div>
    );
  }

  return (
    <Card>
      <div className="divide-y divide-line">
        {items.map((n) => {
          const meta = TYPE_META[n.type];
          const Icon = meta.icon;
          const isRead = read[n.id];
          return (
            <button
              key={n.id}
              onClick={() => markRead(n.id)}
              className={clsx(
                "flex w-full items-start gap-3 px-4 py-4 text-left transition-colors hover:bg-panel/40",
                !isRead && "bg-pine-tint/20"
              )}
            >
              <span className={clsx("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", meta.tone)}>
                <Icon size={16} />
              </span>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-ink">{n.title}</p>
                  {!isRead && <span className="h-1.5 w-1.5 rounded-full bg-clay" />}
                </div>
                <p className="mt-0.5 text-sm text-ink/60">{n.message}</p>
                <p className="stamp mt-1.5 text-[10px] text-ink/35">
                  {n.date} · {n.targetPurokName ?? "All households"}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </Card>
  );
}
