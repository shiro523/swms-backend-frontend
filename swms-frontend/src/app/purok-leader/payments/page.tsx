"use client";

import { useState } from "react";
import { PageHeader, StatCard, Card } from "@/components/ui/Primitives";
import { AsyncSection } from "@/components/ui/AsyncSection";
import { DataTable, Column } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ExportButton } from "@/components/ui/ExportButton";
import type { XlsxColumn } from "@/lib/exportXlsx";
import { RecordPaymentDialog } from "@/components/households/RecordPaymentDialog";
import { useApi } from "@/hooks/useApi";
import { api } from "@/lib/api";
import { sortPeriodsNewestFirst, splitHouseholdsByCurrentPeriod } from "@/lib/paymentPeriod";
import { Payment } from "@/lib/types";
import { Wallet, CircleCheck, CircleX } from "lucide-react";

const xlsxColumns: XlsxColumn<Payment>[] = [
  { header: "Household", accessor: (p) => p.representative },
  { header: "Household Code", accessor: (p) => p.householdCode },
  { header: "Household ID", accessor: (p) => p.householdId },
  { header: "Purok", accessor: (p) => p.purokName },
  { header: "Period", accessor: (p) => p.period },
  { header: "Amount", accessor: (p) => p.amount, numFmt: '"₱"#,##0.00' },
  { header: "Date Paid", accessor: (p) => p.datePaid ?? "" },
  { header: "Status", accessor: (p) => p.status },
];

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
  const [periodFilter, setPeriodFilter] = useState("all");
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

  // Derived from the real payment records already fetched — never a fixed
  // list — so a future period (November 2026, ...) appears here automatically
  // the moment the first payment for it is recorded, with no code change.
  // Newest first, by real date.
  const periodOptions = sortPeriodsNewestFirst(payments.map((p) => p.period));

  // Fall back to "all" if the selected period no longer exists after a reload.
  if (periodFilter !== "all" && query.data && !periodOptions.includes(periodFilter)) {
    setPeriodFilter("all");
  }

  const filteredPayments = periodFilter === "all" ? payments : payments.filter((p) => p.period === periodFilter);

  return (
    <div>
      <PageHeader
        eyebrow={query.data?.purok?.name ?? "Your purok"}
        title="Payments"
        description={currentPeriod ? `Monthly collection fee status for ${currentPeriod}.` : "Monthly collection fee status for households in your purok."}
        actions={
          filteredPayments.length > 0 ? (
            <ExportButton filename="my-payments" rows={filteredPayments} format="xlsx" columns={xlsxColumns} />
          ) : undefined
        }
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

              <div className="mt-4 flex justify-end">
                <select
                  value={periodFilter}
                  onChange={(e) => setPeriodFilter(e.target.value)}
                  className="rounded-lg border border-line bg-paper px-3 py-2 text-[13px] text-ink/70"
                >
                  <option value="all">All periods</option>
                  {periodOptions.map((period) => (
                    <option key={period} value={period}>{period}</option>
                  ))}
                </select>
              </div>

              <div className="mt-2">
                <DataTable
                  data={filteredPayments}
                  columns={columns}
                  searchPlaceholder="Search by household or code…"
                  searchKeys={(p) => `${p.representative} ${p.householdCode} ${p.householdId}`}
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
