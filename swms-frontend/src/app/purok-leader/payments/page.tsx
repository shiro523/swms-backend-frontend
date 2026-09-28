"use client";

import { PageHeader, StatCard, Card } from "@/components/ui/Primitives";
import { AsyncSection } from "@/components/ui/AsyncSection";
import { DataTable, Column } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ExportButton } from "@/components/ui/ExportButton";
import { RecordPaymentDialog } from "@/components/households/RecordPaymentDialog";
import { useApi } from "@/hooks/useApi";
import { api } from "@/lib/api";
import { splitHouseholdsByCurrentPeriod } from "@/lib/paymentPeriod";
import { Payment } from "@/lib/types";
import { Wallet, CircleCheck, CircleX } from "lucide-react";

const columns: Column<Payment>[] = [
  { header: "Household", accessor: (p) => (
      <span className="font-medium text-ink">{p.representative} <span className="stamp text-[10px] text-ink/40">{p.householdCode}</span></span>
    ) },
  { header: "Period", accessor: (p) => p.period },
  { header: "Amount", accessor: (p) => `₱${p.amount.toFixed(2)}` },
  { header: "Date paid", accessor: (p) => p.datePaid ?? "—" },
  { header: "Status", accessor: (p) => <StatusBadge status={p.status} /> },
];

export default function PurokLeaderPaymentsPage() {
  const query = useApi(
    () =>
      Promise.all([api.puroks(), api.households(), api.payments(), api.currentPaymentPeriod()]).then(
        ([puroks, households, payments, currentPeriod]) => ({
          purok: puroks[0],
          households,
          payments,
          currentPeriod: currentPeriod.period,
        }),
      ),
    [],
  );

  const households = query.data?.households ?? [];
  const payments = query.data?.payments ?? [];
  const currentPeriod = query.data?.currentPeriod ?? "";

  const { unpaidHouseholds } = splitHouseholdsByCurrentPeriod(households, payments, currentPeriod);
  const collected = payments.filter((p) => p.status === "paid").reduce((sum, p) => sum + p.amount, 0);

  return (
    <div>
      <PageHeader
        eyebrow={query.data?.purok?.name ?? "Your purok"}
        title="Payments"
        description={currentPeriod ? `Monthly collection fee status for ${currentPeriod}.` : "Monthly collection fee status for households in your purok."}
        actions={payments.length > 0 ? <ExportButton filename="my-payments" rows={payments} /> : undefined}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Collected (all time)" value={`₱${collected.toLocaleString()}`} icon={Wallet} tone="pine" />
        <StatCard label="Paid this period" value={String(households.length - unpaidHouseholds.length)} icon={CircleCheck} tone="pine" />
        <StatCard label="Unpaid this period" value={String(unpaidHouseholds.length)} icon={CircleX} tone="clay" />
      </div>

      <div className="mt-4">
        <AsyncSection query={query}>
          {() => (
            <>
              <Card className="p-5">
                <p className="text-sm font-semibold text-ink">Unpaid this period</p>
                <p className="text-xs text-ink/50">Households with no recorded payment for {currentPeriod || "the current period"}.</p>
                <div className="mt-3 divide-y divide-line">
                  {unpaidHouseholds.map((h) => (
                    <div key={h.id} className="flex items-center justify-between py-2.5 text-sm">
                      <div>
                        <p className="font-medium text-ink">{h.representative}</p>
                        <p className="text-xs text-ink/45">{h.code}</p>
                      </div>
                      <RecordPaymentDialog householdId={h.id} onRecorded={() => query.reload()} />
                    </div>
                  ))}
                  {unpaidHouseholds.length === 0 && (
                    <p className="py-3 text-sm text-ink/40">All households are paid up for {currentPeriod || "this period"}.</p>
                  )}
                </div>
              </Card>

              <div className="mt-4">
                <DataTable
                  data={payments}
                  columns={columns}
                  searchPlaceholder="Search by household or code…"
                  searchKeys={(p) => `${p.representative} ${p.householdCode}`}
                  pageSize={10}
                />
              </div>
            </>
          )}
        </AsyncSection>
      </div>
    </div>
  );
}
