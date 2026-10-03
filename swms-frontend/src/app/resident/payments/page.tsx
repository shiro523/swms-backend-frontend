"use client";

import { PageHeader, Card } from "@/components/ui/Primitives";
import { AsyncSection } from "@/components/ui/AsyncSection";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useApi } from "@/hooks/useApi";
import { api } from "@/lib/api";
import { isSamePeriod } from "@/lib/paymentPeriod";

export default function ResidentPaymentsPage() {
  const query = useApi(
    () =>
      Promise.all([api.payments(), api.households(), api.currentPaymentPeriod()]).then(
        ([payments, households, currentPeriod]) => ({
          payments,
          household: households[0],
          currentPeriod: currentPeriod.period,
        }),
      ),
    [],
  );

  return (
    <div>
      <PageHeader eyebrow="Billing" title="My payments" description="Monthly waste collection fee history for your household." />
      <AsyncSection query={query}>
        {({ payments, household, currentPeriod }) => {
          const status = household?.periodPaymentStatus;
          const paidThisPeriod = payments
            .filter((p) => isSamePeriod(p.period, currentPeriod))
            .reduce((sum, p) => sum + p.amount, 0);
          return (
          <>
          <Card className="mb-4 flex flex-wrap items-center justify-between gap-3 p-5">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-ink/45">{currentPeriod}</p>
              <p className="mt-1 text-sm text-ink/70">
                {status === "paid"
                  ? `Paid · ₱${paidThisPeriod.toFixed(2)} recorded for this period.`
                  : status === "new"
                    ? "No payment yet — your household was registered this month."
                    : "No payment recorded for this period yet. Pay your purok leader or the barangay office."}
              </p>
            </div>
            {status && <StatusBadge status={status} />}
          </Card>
          <Card className="p-5">
            <div className="divide-y divide-line">
              {payments.map((p) => (
                <div key={p.id} className="flex items-center justify-between py-3 text-sm">
                  <div>
                    <p className="font-medium text-ink">{p.period}</p>
                    {p.datePaid && <p className="text-xs text-ink/45">Paid {p.datePaid}</p>}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-[family-name:var(--font-display)] text-sm font-semibold text-ink">₱{p.amount.toFixed(2)}</span>
                    <StatusBadge status={p.status} />
                  </div>
                </div>
              ))}
              {payments.length === 0 && <p className="py-3 text-sm text-ink/40">No payment records yet.</p>}
            </div>
          </Card>
          </>
          );
        }}
      </AsyncSection>
    </div>
  );
}
