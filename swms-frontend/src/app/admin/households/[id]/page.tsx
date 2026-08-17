"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Phone, MapPin, CalendarDays } from "lucide-react";
import { Card, PageHeader } from "@/components/ui/Primitives";
import { AsyncSection } from "@/components/ui/AsyncSection";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EditHouseholdDialog } from "@/components/households/EditHouseholdDialog";
import { useApi } from "@/hooks/useApi";
import { api } from "@/lib/api";

export default function HouseholdDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const query = useApi(
    () =>
      Promise.all([
        api.household(id),
        api.payments(id),
        api.trashLogs(id),
        api.violations(id),
      ]).then(([household, payments, logs, violations]) => ({
        household,
        payments,
        logs,
        violations,
      })),
    [id],
  );

  return (
    <div>
      <Link href="/admin/households" className="flex items-center gap-1.5 text-xs font-medium text-ink/50 hover:text-pine-dark">
        <ArrowLeft size={13} /> Back to households
      </Link>

      <AsyncSection query={query}>
        {({ household, payments, logs, violations }) => (
          <>
            <PageHeader
              eyebrow={household.code}
              title={household.representative}
              description={`House representative for ${household.purokName}`}
              actions={
                <div className="flex items-center gap-2">
                  <StatusBadge status={household.paymentStatus} />
                  <EditHouseholdDialog household={household} onUpdated={() => query.reload()} />
                </div>
              }
            />

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
              <Card className="p-5">
                <p className="text-sm font-semibold text-ink">Household profile</p>
                <div className="mt-3 space-y-2.5 text-sm text-ink/70">
                  <p className="flex items-center gap-2"><MapPin size={14} className="text-ink/40" /> {household.address}</p>
                  <p className="flex items-center gap-2"><Phone size={14} className="text-ink/40" /> {household.contactNumber}</p>
                  <p className="flex items-center gap-2"><CalendarDays size={14} className="text-ink/40" /> Registered {household.registeredAt}</p>
                </div>

                <p className="mt-5 text-sm font-semibold text-ink">Family members</p>
                <div className="mt-2 divide-y divide-line">
                  {household.members.map((m) => (
                    <div key={m.id} className="flex items-center justify-between py-2 text-sm">
                      <span className="text-ink/80">{m.name}</span>
                      <span className="text-xs text-ink/45">{m.relation} · {m.age} y/o</span>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="p-5 xl:col-span-2">
                <p className="text-sm font-semibold text-ink">Complete payment history</p>
                <p className="text-xs text-ink/50">All recorded monthly collection fee payments</p>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="stamp text-[10.5px] text-ink/40">
                        <th className="px-2 py-2 font-medium">Period</th>
                        <th className="px-2 py-2 font-medium">Amount</th>
                        <th className="px-2 py-2 font-medium">OR Number</th>
                        <th className="px-2 py-2 font-medium">Date paid</th>
                        <th className="px-2 py-2 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map((p) => (
                        <tr key={p.id} className="ledger-row">
                          <td className="px-2 py-2.5">{p.period}</td>
                          <td className="px-2 py-2.5">₱{p.amount.toFixed(2)}</td>
                          <td className="px-2 py-2.5 text-ink/50">{p.orNumber ?? "—"}</td>
                          <td className="px-2 py-2.5 text-ink/50">{p.datePaid ?? "—"}</td>
                          <td className="px-2 py-2.5"><StatusBadge status={p.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <p className="mt-6 text-sm font-semibold text-ink">Trash collection logs</p>
                <div className="mt-2 divide-y divide-line">
                  {logs.length === 0 && <p className="py-3 text-sm text-ink/40">No collection logs yet.</p>}
                  {logs.map((log) => (
                    <div key={log.id} className="flex items-center justify-between py-2.5 text-sm">
                      <span className="text-ink/70">{log.date} · {log.time} · {log.collector}</span>
                      <StatusBadge status={log.status} />
                    </div>
                  ))}
                </div>

                {violations.length > 0 && (
                  <>
                    <p className="mt-6 text-sm font-semibold text-ink">Violation history</p>
                    <div className="mt-2 divide-y divide-line">
                      {violations.map((v) => (
                        <div key={v.id} className="flex items-center justify-between py-2.5 text-sm">
                          <span className="text-ink/70">{v.date} · {v.type}</span>
                          {v.isRepeat && <StatusBadge status="violation" />}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </Card>
            </div>
          </>
        )}
      </AsyncSection>
    </div>
  );
}
