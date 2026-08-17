"use client";

import Link from "next/link";
import { QrCode, Wallet, AlertTriangle, ArrowRight } from "lucide-react";
import { PageHeader, StatCard, Card } from "@/components/ui/Primitives";
import { AsyncSection } from "@/components/ui/AsyncSection";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useApi } from "@/hooks/useApi";
import { api } from "@/lib/api";

export default function ResidentDashboard() {
  const query = useApi(
    () =>
      Promise.all([
        api.households(),
        api.payments(),
        api.trashLogs(),
        api.violations(),
        api.notifications(),
      ]).then(([households, payments, trashLogs, violations, notifications]) => ({
        household: households[0],
        payments,
        trashLogs,
        violations,
        notifications,
      })),
    [],
  );

  return (
    <AsyncSection query={query}>
      {({ household, payments, trashLogs, violations, notifications }) => {
        const latestPayment = payments[payments.length - 1];
        const recentLogs = trashLogs.slice(0, 4);
        const nextCollection = notifications.find((n) => n.type === "collection");

        return (
          <div>
            <PageHeader
              eyebrow={household?.code ?? ""}
              title={`Welcome back, ${household?.representative.split(" ")[0] ?? ""}`}
              description={household ? `${household.purokName} · ${household.address}` : ""}
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <StatCard label="Compliance rate" value={`${household?.complianceRate ?? 0}%`} icon={QrCode} tone="pine" />
              <StatCard
                label="This period's fee"
                value={latestPayment ? `₱${latestPayment.amount.toFixed(2)}` : "—"}
                sub={latestPayment?.status}
                icon={Wallet}
                tone="azure"
              />
              <StatCard label="Violations on record" value={String(violations.length)} icon={AlertTriangle} tone="clay" />
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
              <Card className="p-5 xl:col-span-2">
                <p className="text-sm font-semibold text-ink">Recent trash logs</p>
                <div className="mt-3 divide-y divide-line">
                  {recentLogs.map((log) => (
                    <div key={log.id} className="flex items-center justify-between py-2.5 text-sm">
                      <span className="text-ink/70">{log.date} · {log.time} · {log.collector}</span>
                      <StatusBadge status={log.status} />
                    </div>
                  ))}
                  {recentLogs.length === 0 && <p className="py-3 text-sm text-ink/40">No collection logs yet.</p>}
                </div>
              </Card>

              <div className="space-y-4">
                <Card className="flex flex-col items-center gap-2 p-5 text-center">
                  <span className="stamp text-[10.5px] text-ink/40">Next collection</span>
                  <p className="text-sm text-ink/70">{nextCollection?.message ?? "No schedule posted yet."}</p>
                  <Link href="/resident/notifications" className="mt-1 flex items-center gap-1 text-xs font-medium text-pine-dark hover:underline">
                    View all notifications <ArrowRight size={12} />
                  </Link>
                </Card>
                <Link
                  href="/resident/qr-code"
                  className="flex items-center justify-between rounded-2xl border border-line bg-pine-dark px-5 py-4 text-white transition-opacity hover:opacity-90"
                >
                  <span>
                    <span className="block text-sm font-semibold">View my QR code</span>
                    <span className="block text-xs text-white/60">Works offline once loaded</span>
                  </span>
                  <QrCode size={22} />
                </Link>
              </div>
            </div>
          </div>
        );
      }}
    </AsyncSection>
  );
}
