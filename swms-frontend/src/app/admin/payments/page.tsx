"use client";

import { useState } from "react";
import { PageHeader, StatCard } from "@/components/ui/Primitives";
import { AsyncSection } from "@/components/ui/AsyncSection";
import { DataTable, Column } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ExportButton } from "@/components/ui/ExportButton";
import { useApi } from "@/hooks/useApi";
import { api } from "@/lib/api";
import { Payment, PaymentStatus } from "@/lib/types";
import { Wallet, CircleCheck, CircleX } from "lucide-react";

const columns: Column<Payment>[] = [
  { header: "Household", accessor: (p) => (
      <span className="font-medium text-ink">{p.representative} <span className="stamp text-[10px] text-ink/40">{p.householdCode}</span></span>
    ) },
  { header: "Purok", accessor: (p) => p.purokName },
  { header: "Period", accessor: (p) => p.period },
  { header: "Amount", accessor: (p) => `₱${p.amount.toFixed(2)}` },
  { header: "OR number", accessor: (p) => p.orNumber ?? "—" },
  { header: "Date paid", accessor: (p) => p.datePaid ?? "—" },
  { header: "Status", accessor: (p) => <StatusBadge status={p.status} /> },
];

const FILTERS: { label: string; value: PaymentStatus | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Paid", value: "paid" },
  { label: "Unpaid", value: "unpaid" },
];

export default function PaymentsPage() {
  const [filter, setFilter] = useState<PaymentStatus | "all">("all");
  const query = useApi(() => api.payments(), []);
  const payments = query.data ?? [];

  const filtered = filter === "all" ? payments : payments.filter((p) => p.status === filter);
  const paid = payments.filter((p) => p.status === "paid");
  const unpaid = payments.filter((p) => p.status === "unpaid");
  const collected = paid.reduce((sum, p) => sum + p.amount, 0);

  // Derived from the actual periods present in the fetched payments —
  // never a hardcoded/invented date.
  const periods = Array.from(new Set(payments.map((p) => p.period)));
  const periodEyebrow =
    periods.length === 0 ? "Collection" : periods.length === 1 ? `${periods[0]} collection` : "All collection periods";

  return (
    <div>
      <PageHeader
        eyebrow={periodEyebrow}
        title="Payments"
        description="Monthly waste collection fee status across all households."
        actions={<ExportButton filename="payments" rows={filtered} />}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Collected" value={`₱${collected.toLocaleString()}`} sub={`${paid.length} households paid`} icon={Wallet} tone="pine" />
        <StatCard label="Paid" value={String(paid.length)} icon={CircleCheck} tone="pine" />
        <StatCard label="Unpaid" value={String(unpaid.length)} icon={CircleX} tone="clay" />
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
            columns={columns}
            searchPlaceholder="Search by household or code…"
            searchKeys={(p) => `${p.representative} ${p.householdCode}`}
            pageSize={10}
          />
        )}
      </AsyncSection>
    </div>
  );
}
