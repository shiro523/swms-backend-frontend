"use client";

import { useState } from "react";
import { PageHeader, StatCard } from "@/components/ui/Primitives";
import { AsyncSection } from "@/components/ui/AsyncSection";
import { DataTable, Column } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ExportButton } from "@/components/ui/ExportButton";
import { useApi } from "@/hooks/useApi";
import { api } from "@/lib/api";
import { splitHouseholdsByCurrentPeriod } from "@/lib/paymentPeriod";
import { CorrectPaymentPeriodDialog } from "@/components/payments/CorrectPaymentPeriodDialog";
import { Payment, PaymentStatus } from "@/lib/types";
import { Wallet, CircleCheck, CircleX } from "lucide-react";

function buildColumns(onCorrected: () => void): Column<Payment>[] {
  return [
    { header: "Household", accessor: (p) => (
        <span className="font-medium text-ink">{p.representative} <span className="stamp text-[10px] text-ink/40">{p.householdCode}</span></span>
      ) },
    { header: "Purok", accessor: (p) => p.purokName },
    { header: "Period", accessor: (p) => p.period },
    { header: "Amount", accessor: (p) => (p.status === "unpaid" ? "—" : `₱${p.amount.toFixed(2)}`) },
    { header: "Date paid", accessor: (p) => p.datePaid ?? "—" },
    { header: "Status", accessor: (p) => <StatusBadge status={p.status} /> },
    {
      header: "Actions",
      // Synthetic "Unpaid" placeholder rows (id starts with "unpaid-") have
      // no real Payment to correct — only real, already-paid rows get the
      // action.
      accessor: (p) => (p.status === "unpaid" ? null : <CorrectPaymentPeriodDialog payment={p} onCorrected={onCorrected} />),
    },
  ];
}

const FILTERS: { label: string; value: PaymentStatus | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Paid", value: "paid" },
  { label: "Unpaid", value: "unpaid" },
];

export default function PaymentsPage() {
  const [filter, setFilter] = useState<PaymentStatus | "all">("all");
  const query = useApi(
    () =>
      Promise.all([api.households(), api.payments(), api.currentPaymentPeriod()]).then(
        ([households, payments, currentPeriod]) => ({ households, payments, currentPeriod: currentPeriod.period }),
      ),
    [],
  );
  const households = query.data?.households ?? [];
  const payments = query.data?.payments ?? [];
  const currentPeriod = query.data?.currentPeriod ?? "";

  // Paid/unpaid for the current billing period, derived from actual Payment
  // records — never from Payment.status (always "paid", not period-aware)
  // or Household.paymentStatus (means "ever paid," not "paid this period").
  const { paidHouseholdIds, paidHouseholds, unpaidHouseholds } = splitHouseholdsByCurrentPeriod(
    households,
    payments,
    currentPeriod,
  );

  // The Unpaid tab can't show a real Payment row — by definition, an unpaid
  // household has no payment record for the current period, so the only
  // rows that could exist for them are historical (from an earlier period,
  // when they WERE paid), which would misleadingly show a "Paid" status
  // badge under an "Unpaid" heading. Synthesizing one placeholder row per
  // unpaid household — built from data already fetched (unpaidHouseholds),
  // never a fabricated record — makes the tab show exactly what's true
  // ("no payment recorded for this period") without ever surfacing a stale
  // paid record in the wrong context. All/Paid are unaffected and still
  // show real Payment rows, including full history.
  const unpaidRows: Payment[] = unpaidHouseholds.map((h) => ({
    id: `unpaid-${h.id}`,
    householdId: h.id,
    householdCode: h.code,
    representative: h.representative,
    purokName: h.purokName,
    period: currentPeriod,
    amount: 0,
    status: "unpaid",
  }));

  const filtered =
    filter === "all"
      ? payments
      : filter === "paid"
        ? payments.filter((p) => paidHouseholdIds.has(p.householdId))
        : unpaidRows;

  const collected = payments.filter((p) => p.status === "paid").reduce((sum, p) => sum + p.amount, 0);
  const periodEyebrow = currentPeriod ? `${currentPeriod} collection` : "Collection";

  return (
    <div>
      <PageHeader
        eyebrow={periodEyebrow}
        title="Payments"
        description="Monthly waste collection fee status across all households."
        actions={<ExportButton filename="payments" rows={filtered} />}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Collected (all time)" value={`₱${collected.toLocaleString()}`} sub={`${paidHouseholds.length} households paid this period`} icon={Wallet} tone="pine" />
        <StatCard label="Paid this period" value={String(paidHouseholds.length)} icon={CircleCheck} tone="pine" />
        <StatCard label="Unpaid this period" value={String(unpaidHouseholds.length)} icon={CircleX} tone="clay" />
      </div>

      <div className="my-4 flex gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`stamp rounded-lg border px-3 py-1.5 text-[11px] font-medium transition-colors ${
              filter === f.value
                ? "border-pine bg-pine-tint text-pine-dark"
                : "border-line bg-paper text-ink/50 hover:text-ink"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <AsyncSection query={query}>
        {() => (
          <DataTable
            data={filtered}
            columns={buildColumns(() => query.reload())}
            searchPlaceholder="Search by household or code…"
            searchKeys={(p) => `${p.representative} ${p.householdCode}`}
            pageSize={10}
          />
        )}
      </AsyncSection>
    </div>
  );
}
