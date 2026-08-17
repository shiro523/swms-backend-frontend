"use client";

import Link from "next/link";
import { Home, Wallet, AlertTriangle, TrendingUp, ScanLine } from "lucide-react";
import { PageHeader, StatCard, Card } from "@/components/ui/Primitives";
import { AsyncSection } from "@/components/ui/AsyncSection";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useApi } from "@/hooks/useApi";
import { api } from "@/lib/api";

export default function PurokLeaderDashboard() {
  const query = useApi(
    () =>
      Promise.all([
        api.puroks(),
        api.households(),
        api.payments(),
        api.trashLogs(),
        api.violations(),
      ]).then(([puroks, households, payments, trashLogs, violations]) => ({
        purok: puroks[0],
        households,
        payments,
        trashLogs,
        violations,
      })),
    [],
  );

  return (
    <AsyncSection query={query}>
      {({ purok, households, payments, trashLogs, violations }) => {
        const paid = payments.filter((p) => p.status === "paid").length;
        const unpaid = payments.filter((p) => p.status === "unpaid").length;
        const recentLogs = trashLogs.slice(0, 6);
        const unpaidHouseholds = payments.filter((p) => p.status !== "paid");

        return (
          <div>
            <PageHeader
              eyebrow={purok?.name ?? "Your purok"}
              title="Purok dashboard"
              description="Compliance and collection status for households under your purok."
            />

            <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-[1.5fr_0.8fr]">
              <Card className="flex items-center justify-between p-5">
                <div>
                  <p className="text-sm font-semibold text-ink">Field scanning</p>
                  <p className="mt-1 text-sm text-ink/55">Scan household or bin QR stickers directly in the field.</p>
                </div>
                <Link
                  href="/purok-leader/scan"
                  className="inline-flex items-center gap-2 rounded-full border border-pine/20 bg-pine-tint px-4 py-2.5 text-sm font-semibold text-pine-dark transition-colors hover:bg-pine/10"
                >
                  <ScanLine size={15} /> Scan QR
                </Link>
              </Card>
              <Card className="p-5">
                <p className="text-sm font-semibold text-ink">Quick note</p>
                <p className="mt-1 text-sm text-ink/55">Scans recorded in the field appear across these dashboards in real time.</p>
              </Card>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Households" value={String(households.length)} icon={Home} tone="pine" />
              <StatCard label="Paid this period" value={String(paid)} sub={`${unpaid} unpaid`} icon={Wallet} tone="azure" />
              <StatCard label="Violations" value={String(violations.length)} icon={AlertTriangle} tone="clay" />
              <StatCard label="Compliance rate" value={`${purok?.complianceRate ?? 0}%`} icon={TrendingUp} tone="gold" />
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
              <Card className="p-5">
                <p className="text-sm font-semibold text-ink">Recent trash logs</p>
                <div className="mt-3 divide-y divide-line">
                  {recentLogs.map((log) => (
                    <div key={log.id} className="flex items-center justify-between py-2.5 text-sm">
                      <div>
                        <p className="font-medium text-ink">{log.representative}</p>
                        <p className="text-xs text-ink/45">{log.householdCode}</p>
                      </div>
                      <div className="text-right">
                        <StatusBadge status={log.status} />
                        <p className="mt-1 text-xs text-ink/40">{log.date}</p>
                      </div>
                    </div>
                  ))}
                  {recentLogs.length === 0 && <p className="py-3 text-sm text-ink/40">No collection logs yet.</p>}
                </div>
              </Card>

              <Card className="p-5">
                <p className="text-sm font-semibold text-ink">Unpaid households</p>
                <div className="mt-3 divide-y divide-line">
                  {unpaidHouseholds.map((p) => (
                    <div key={p.id} className="flex items-center justify-between py-2.5 text-sm">
                      <div>
                        <p className="font-medium text-ink">{p.representative}</p>
                        <p className="text-xs text-ink/45">{p.householdCode} · {p.period}</p>
                      </div>
                      <StatusBadge status={p.status} />
                    </div>
                  ))}
                  {unpaidHouseholds.length === 0 && (
                    <p className="py-3 text-sm text-ink/40">All households are paid up for this period.</p>
                  )}
                </div>
              </Card>
            </div>
          </div>
        );
      }}
    </AsyncSection>
  );
}
