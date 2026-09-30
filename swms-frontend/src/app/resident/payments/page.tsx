"use client";

import { PageHeader, Card } from "@/components/ui/Primitives";
import { AsyncSection } from "@/components/ui/AsyncSection";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useApi } from "@/hooks/useApi";
import { api } from "@/lib/api";

export default function ResidentPaymentsPage() {
  const query = useApi(() => api.payments(), []);

  return (
    <div>
      <PageHeader eyebrow="Billing" title="My payments" description="Monthly waste collection fee history for your household." />
      <AsyncSection query={query}>
        {(payments) => (
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
        )}
      </AsyncSection>
    </div>
  );
}
