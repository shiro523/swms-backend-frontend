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

          return (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard label="Total households" value={String(households.length)} sub={`${puroks.length} puroks`} icon={Home} tone="pine" />
                <StatCard label="Paid this period" value={String(paid)} sub={`${unpaid} unpaid`} icon={Wallet} tone="azure" />
                <StatCard label="Open violations" value={String(violations.length)} sub="Last 28 days" icon={AlertTriangle} tone="clay" />
                <StatCard label="Avg. compliance" value="87%" sub="+3pts vs last month" icon={MapPinned} tone="gold" />
              </div>

              <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
                <Card className="p-5 xl:col-span-2">
                  <p className="text-sm font-semibold text-ink">Monthly collection statistics</p>
                  <p className="text-xs text-ink/50">Compliant vs. violation vs. missed collections</p>
                  <ComplianceTrendChart data={monthly} />
                </Card>
                <Card className="p-5">
                  <p className="text-sm font-semibold text-ink">Paid vs. unpaid households</p>
                  <p className="text-xs text-ink/50">July 2026 collection period</p>
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
