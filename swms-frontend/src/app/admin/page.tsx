"use client";

import { Home, Wallet, AlertTriangle, MapPinned } from "lucide-react";
import { PageHeader, StatCard, Card } from "@/components/ui/Primitives";
import { AsyncSection } from "@/components/ui/AsyncSection";
import {
  ComplianceTrendChart,
  PurokComplianceBar,
  PaidUnpaidPie,
} from "@/components/charts/DashboardCharts";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useApi } from "@/hooks/useApi";
import { api } from "@/lib/api";

export default function AdminDashboard() {
  const query = useApi(
    () =>
      Promise.all([
        api.households(),
        api.payments(),
        api.violations(),
        api.puroks(),
        api.monthlyCollectionStats(),
        api.trashLogs(),
      ]).then(([households, payments, violations, puroks, monthly, logs]) => ({
        households,
        payments,
        violations,
        puroks,
        monthly,
        logs,
      })),
    [],
  );

  return (
    <div>
      <PageHeader
        eyebrow="Barangay overview"
        title="Admin dashboard"
        description="Compliance, collections, and payment status across all puroks."
      />

      <AsyncSection query={query}>
        {({ households, payments, violations, puroks, monthly, logs }) => {
          const paid = payments.filter((p) => p.status === "paid").length;
          const unpaid = payments.filter((p) => p.status === "unpaid").length;
          const recentLogs = logs.slice(0, 6);

          const avgCompliance =
            puroks.length > 0
              ? Math.round(puroks.reduce((sum, p) => sum + p.complianceRate, 0) / puroks.length)
              : null;

          // Month-over-month delta computed from the same live monthly stats
          // already fetched (C-1) — not a separate/fabricated metric.
          const monthRate = (m: { compliant: number; violations: number; missed: number }) => {
            const total = m.compliant + m.violations + m.missed;
            return total > 0 ? (m.compliant / total) * 100 : null;
          };
          const currentMonth = monthly[monthly.length - 1];
          const previousMonth = monthly.length > 1 ? monthly[monthly.length - 2] : undefined;
          const currentRate = currentMonth ? monthRate(currentMonth) : null;
          const previousRate = previousMonth ? monthRate(previousMonth) : null;
          const complianceDelta =
            currentRate !== null && previousRate !== null
              ? Math.round(currentRate) - Math.round(previousRate)
              : null;
          const complianceDeltaLabel =
            complianceDelta === null
              ? "No prior-month data yet"
              : complianceDelta === 0
                ? "No change vs last month"
                : `${complianceDelta > 0 ? "+" : ""}${complianceDelta}pts vs last month`;

          // Same period-label logic as admin/payments/page.tsx — derived from
          // the actual periods present in the fetched payments, never invented.
          const periods = Array.from(new Set(payments.map((p) => p.period)));
          const periodCaption =
            periods.length === 0
              ? "No payments recorded yet"
              : periods.length === 1
                ? `${periods[0]} collection period`
                : "All recorded collection periods";

          return (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard label="Total households" value={String(households.length)} sub={`${puroks.length} puroks`} icon={Home} tone="pine" />
                <StatCard label="Paid this period" value={String(paid)} sub={`${unpaid} unpaid`} icon={Wallet} tone="azure" />
                <StatCard label="Open violations" value={String(violations.length)} sub="Last 28 days" icon={AlertTriangle} tone="clay" />
                <StatCard
                  label="Avg. compliance"
                  value={avgCompliance !== null ? `${avgCompliance}%` : "—"}
                  sub={complianceDeltaLabel}
                  icon={MapPinned}
                  tone="gold"
                />
              </div>

              <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
                <Card className="p-5 xl:col-span-2">
                  <p className="text-sm font-semibold text-ink">Monthly collection statistics</p>
                  <p className="text-xs text-ink/50">Compliant vs. violation vs. missed collections</p>
                  <ComplianceTrendChart data={monthly} />
                </Card>
                <Card className="p-5">
                  <p className="text-sm font-semibold text-ink">Paid vs. unpaid households</p>
                  <p className="text-xs text-ink/50">{periodCaption}</p>
                  <PaidUnpaidPie paid={paid} unpaid={unpaid} />
                </Card>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
                <Card className="p-5 xl:col-span-2">
                  <p className="text-sm font-semibold text-ink">Recent trash logs</p>
                  <p className="text-xs text-ink/50">Latest scans recorded during collection</p>
                  <div className="mt-3 divide-y divide-line">
                    {recentLogs.map((log) => (
                      <div key={log.id} className="flex items-center justify-between py-2.5 text-sm">
                        <div>
                          <p className="font-medium text-ink">{log.representative}</p>
                          <p className="text-xs text-ink/45">{log.householdCode} · {log.purokName}</p>
                        </div>
                        <div className="text-right">
                          <StatusBadge status={log.status} />
                          <p className="mt-1 text-xs text-ink/40">{log.date}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
                <Card className="p-5">
                  <p className="text-sm font-semibold text-ink">Compliance by purok</p>
                  <p className="text-xs text-ink/50">Share of compliant collections</p>
                  <PurokComplianceBar puroks={puroks} />
                </Card>
              </div>
            </>
          );
        }}
      </AsyncSection>
    </div>
  );
}
