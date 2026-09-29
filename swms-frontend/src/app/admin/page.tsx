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
import { splitHouseholdsByCurrentPeriod } from "@/lib/paymentPeriod";

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
        api.currentPaymentPeriod(),
      ]).then(([households, payments, violations, puroks, monthly, logs, currentPeriod]) => ({
        households,
        payments,
        violations,
        puroks,
        monthly,
        logs,
        currentPeriod: currentPeriod.period,
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
        {({ households, payments, violations, puroks, monthly, logs, currentPeriod }) => {
          // Paid/unpaid for the current billing period, derived from actual
          // Payment records matched against the server's authoritative
          // current-period label — never from Payment.status (always "paid",
          // not period-aware) or Household.paymentStatus (means "ever paid,"
          // not "paid this period").
          const { paidHouseholds, unpaidHouseholds } = splitHouseholdsByCurrentPeriod(households, payments, currentPeriod);
          const paid = paidHouseholds.length;
          const unpaid = unpaidHouseholds.length;
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

          const periodCaption = currentPeriod ? `${currentPeriod} collection period` : "Current collection period";

          return (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard label="Total households" value={String(households.length)} sub={`${puroks.length} puroks`} icon={Home} tone="pine" />
                <StatCard label="Paid this period" value={String(paid)} sub={`${unpaid} unpaid`} icon={Wallet} tone="azure" />
                <StatCard
                  label="Open violations"
                  value={String(violations.filter((v) => v.status === "active").length)}
                  sub="Currently active"
                  icon={AlertTriangle}
                  tone="clay"
                />
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
