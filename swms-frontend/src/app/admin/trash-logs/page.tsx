"use client";

import { useState } from "react";
import { PageHeader } from "@/components/ui/Primitives";
import { AsyncSection } from "@/components/ui/AsyncSection";
import { DataTable, Column } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ExportButton } from "@/components/ui/ExportButton";
import { useApi } from "@/hooks/useApi";
import { api } from "@/lib/api";
import { TrashLog } from "@/lib/types";

const columns: Column<TrashLog>[] = [
  { header: "Date", accessor: (t) => t.date },
  { header: "Time", accessor: (t) => t.time },
  { header: "Household", accessor: (t) => (
      <span className="font-medium text-ink">{t.representative} <span className="stamp text-[10px] text-ink/40">{t.householdCode}</span></span>
    ) },
  { header: "Purok", accessor: (t) => t.purokName },
  { header: "Collector", accessor: (t) => t.collector },
  { header: "Disposed by", accessor: (t) => (t.disposedBy === "owner" ? "Owner" : "Representative") },
  { header: "Status", accessor: (t) => <StatusBadge status={t.status} /> },
];

export default function TrashLogsPage() {
  const [from, setFrom] = useState("2026-07-01");
  const [to, setTo] = useState("2026-07-31");
  const query = useApi(() => api.trashLogs(), []);

  const filtered = (query.data ?? []).filter((t) => t.date >= from && t.date <= to);

  return (
    <div>
      <PageHeader
        eyebrow={`${filtered.length} entries`}
        title="Trash logs"
        description="QR scans recorded by staff during collection, including embedded violations."
        actions={<ExportButton filename="trash-logs" rows={filtered} />}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-xs font-medium text-ink/50">Date range</span>
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="rounded-lg border border-line bg-paper px-2.5 py-1.5 text-xs text-ink"
        />
        <span className="text-ink/30">to</span>
        <input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="rounded-lg border border-line bg-paper px-2.5 py-1.5 text-xs text-ink"
        />
      </div>

      <AsyncSection query={query}>
        {() => (
          <DataTable
            data={filtered}
            columns={columns}
            searchPlaceholder="Search by household, code, or collector…"
            searchKeys={(t) => `${t.representative} ${t.householdCode} ${t.collector}`}
            pageSize={10}
          />
        )}
      </AsyncSection>
    </div>
  );
}
