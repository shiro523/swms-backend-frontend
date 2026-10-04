"use client";

import Link from "next/link";
import { Home, Wallet, AlertTriangle, TrendingUp, ScanLine } from "lucide-react";
import { PageHeader, StatCard, Card } from "@/components/ui/Primitives";
import { AsyncSection } from "@/components/ui/AsyncSection";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ViewAllLink } from "@/components/ui/ViewAllLink";
import { useApi } from "@/hooks/useApi";
import { api } from "@/lib/api";
import { householdsAwaitingPayment, UNPAID_LIST_HREF } from "@/lib/householdStatus";

// The dashboard previews the first few; "View all" opens the full list.
const UNPAID_PREVIEW_LIMIT = 5;


export default function PurokLeaderDashboard() {
  const query = useApi(
    () =>
      Promise.all([
        api.puroks(),
        api.households(),
        api.trashLogs(),
        api.violations(),
        api.currentPaymentPeriod(),
      ]).then(([puroks, households, trashLogs, violations, currentPeriod]) => ({
        purok: puroks[0],
        households,
        trashLogs,
        violations,
        currentPeriod: currentPeriod.period,
      })),
    [],
  );

  return (
    <AsyncSection query={query}>
      {({ purok, households, trashLogs, violations, currentPeriod }) => {
        // Current-period status comes from the server (periodPaymentStatus):
        // paid / unpaid / new (registered this month, not paid yet).
        const awaiting = householdsAwaitingPayment(households);
        const paid = households.length - awaiting.length;
        const unpaid = awaiting.filter((h) => h.periodPaymentStatus === "unpaid").length;
        const newHouseholds = awaiting.length - unpaid;
        const recentLogs = trashLogs.slice(0, 6);
        // Open violations only (completed ones are resolved) — same meaning
        // as the admin dashboard's "Open violations".
        const openViolations = violations.filter((v) => v.status === "active").length;
        // Live from the households themselves, same formula the server uses
        // for the purok figure (average over households with at least one
        // log). The stored purok.complianceRate only refreshes when a log is
        // saved, so it can lag or still be the placeholder 100%.
        const withRecords = households.filter((h) => h.hasCollectionRecords);
        const complianceRate =
          withRecords.length > 0
            ? `${Math.round(withRecords.reduce((sum, h) => sum + h.complianceRate, 0) / withRecords.length)}%`
            : "—";

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
              <StatCard
                label="Paid this period"
                value={String(paid)}
                sub={newHouseholds > 0 ? `${unpaid} unpaid · ${newHouseholds} new` : `${unpaid} unpaid`}
                icon={Wallet}
                tone="azure"
              />
              <StatCard
                label="Open violations"
                value={String(openViolations)}
                sub={`${violations.length} recorded in total`}
                icon={AlertTriangle}
                tone="clay"
              />
              <StatCard
                label="Compliance rate"
                value={complianceRate}
                sub={withRecords.length === 0 ? "No collections recorded yet" : `Across ${withRecords.length} household${withRecords.length === 1 ? "" : "s"} with records`}
                icon={TrendingUp}
                tone="gold"
              />
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
              <Card className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold text-ink">Recent trash logs</p>
                  <ViewAllLink href="/purok-leader/trash-logs" />
                </div>
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
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-ink">Unpaid households</p>
                    <p className="text-xs text-ink/50">No recorded payment for {currentPeriod || "the current period"}.</p>
                  </div>
                  <ViewAllLink href={UNPAID_LIST_HREF} />
                </div>
                <div className="mt-3 divide-y divide-line">
                  {awaiting.slice(0, UNPAID_PREVIEW_LIMIT).map((h) => (
                    <div key={h.id} className="flex items-center justify-between py-2.5 text-sm">
                      <div>
                        <p className="font-medium text-ink">{h.representative}</p>
                        <p className="text-xs text-ink/45">{h.code}</p>
                      </div>
                      <StatusBadge status={h.periodPaymentStatus} />
                    </div>
                  ))}
                  {awaiting.length > UNPAID_PREVIEW_LIMIT && (
                    <Link href={UNPAID_LIST_HREF} className="block py-2.5 text-xs font-medium text-pine hover:text-pine-dark">
                      +{awaiting.length - UNPAID_PREVIEW_LIMIT} more — view the full list
                    </Link>
                  )}
                  {awaiting.length === 0 && (
                    <p className="py-3 text-sm text-ink/40">All households are paid up for {currentPeriod || "this period"}.</p>
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
