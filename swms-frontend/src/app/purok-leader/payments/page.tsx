"use client";

import { PageHeader, StatCard } from "@/components/ui/Primitives";
import { AsyncSection } from "@/components/ui/AsyncSection";
import { DataTable, Column } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ExportButton } from "@/components/ui/ExportButton";
import { useApi } from "@/hooks/useApi";
import { api } from "@/lib/api";
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
      Promise.all([api.puroks(), api.payments()]).then(([puroks, payments]) => ({
        purok: puroks[0],
        payments,
      })),
    [],
  );

  const payments = query.data?.payments ?? [];
  const paid = payments.filter((p) => p.status === "paid");
  const unpaid = payments.filter((p) => p.status !== "paid");
  const collected = paid.reduce((sum, p) => sum + p.amount, 0);

  return (
    <div>
      <PageHeader
        eyebrow={query.data?.purok?.name ?? "Your purok"}
        title="Payments"
        description="Monthly collection fee status for households in your purok."
        actions={payments.length > 0 ? <ExportButton filename="my-payments" rows={payments} /> : undefined}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Collected" value={`₱${collected.toLocaleString()}`} icon={Wallet} tone="pine" />
        <StatCard label="Paid" value={String(paid.length)} icon={CircleCheck} tone="pine" />
        <StatCard label="Unpaid / pending" value={String(unpaid.length)} icon={CircleX} tone="clay" />
      </div>

      <div className="mt-4">
        <AsyncSection query={query}>
          {({ payments }) => (
            <DataTable
              data={payments}
              columns={columns}
              searchPlaceholder="Search by household or code…"
              searchKeys={(p) => `${p.representative} ${p.householdCode}`}
              pageSize={10}
            />
          )}
        </AsyncSection>
      </div>
    </div>
  );
}
