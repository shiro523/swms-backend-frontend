"use client";

import Link from "next/link";
import { QrCode, Wallet, AlertTriangle, ArrowRight } from "lucide-react";
import { PageHeader, StatCard, Card } from "@/components/ui/Primitives";
import { AsyncSection } from "@/components/ui/AsyncSection";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ViewAllLink } from "@/components/ui/ViewAllLink";
import { useApi } from "@/hooks/useApi";
import { api } from "@/lib/api";
import { complianceLabel } from "@/lib/householdStatus";
import { isSamePeriod } from "@/lib/paymentPeriod";
import type { Household, Payment } from "@/lib/types";

// "2026-10-04" -> "Sunday, October 4" (local calendar date, never via UTC).
function formatCollectionDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
}

// The current period's payment status, from the server's periodPaymentStatus
// plus every payment recorded for that period (partial payments add up).
function periodPaymentCard(household: Household | undefined, payments: Payment[], currentPeriod: string) {
  const forPeriod = payments.filter((p) => isSamePeriod(p.period, currentPeriod));
  const total = forPeriod.reduce((sum, p) => sum + p.amount, 0);
  switch (household?.periodPaymentStatus) {
    case "paid":
      return { value: `₱${total.toFixed(2)}`, sub: `Paid for ${currentPeriod}` };
    case "new":
      return { value: "Not yet paid", sub: `${currentPeriod} · new household` };
    case "unpaid":
      return { value: "Unpaid", sub: `No payment recorded for ${currentPeriod}` };
    default:
      return { value: "—", sub: undefined };
  }
}

export default function ResidentDashboard() {
  const query = useApi(
    () =>
      Promise.all([
        api.households(),
        api.payments(),
        api.trashLogs(),
        api.violations(),
        api.currentPaymentPeriod(),
        api.collectionWeek(),
      ]).then(([households, payments, trashLogs, violations, currentPeriod, collectionWeek]) => ({
        household: households[0],
        payments,
        trashLogs,
        violations,
        currentPeriod: currentPeriod.period,
        collectionWeek,
      })),
    [],
  );

  return (
    <AsyncSection query={query}>
      {({ household, payments, trashLogs, violations, currentPeriod, collectionWeek }) => {
        const periodCard = periodPaymentCard(household, payments, currentPeriod);
        const activeViolations = violations.filter((v) => v.status === "active").length;
        const recentLogs = trashLogs.slice(0, 4);
        // The real schedule (Admin Settings → collection day/time), not a
        // notification message.
        const nextCollection = collectionWeek.nextCollectionDate;
        // The next collection is today exactly when it's this week's start.
        const isToday = nextCollection === collectionWeek.weekStart;

        return (
          <div>
            <PageHeader
              eyebrow={household?.code ?? ""}
              title={`Welcome back, ${household?.representative.split(" ")[0] ?? ""}`}
              description={household ? `${household.purokName} · ${household.address}` : ""}
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <StatCard label="Compliance rate" value={household ? complianceLabel(household) : "—"} sub={household && !household.hasCollectionRecords ? "No collections recorded yet" : undefined} icon={QrCode} tone="pine" />
              <StatCard label="This period's payment" value={periodCard.value} sub={periodCard.sub} icon={Wallet} tone="azure" />
              <StatCard
                label="Active violations"
                value={String(activeViolations)}
                sub={`${violations.length} on record in total`}
                icon={AlertTriangle}
                tone="clay"
              />
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
              <Card className="p-5 xl:col-span-2">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold text-ink">Recent trash logs</p>
                  <ViewAllLink href="/resident/trash-logs" />
                </div>
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
                  <p className="font-[family-name:var(--font-display)] text-lg font-semibold text-ink">
                    {isToday ? "Today" : formatCollectionDate(nextCollection)}
                  </p>
                  <p className="text-sm text-ink/60">
                    {isToday ? formatCollectionDate(nextCollection) : `Every ${collectionWeek.collectionDay}`}
                    {collectionWeek.collectionTime ? ` · ${collectionWeek.collectionTime}` : ""}
                  </p>
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
