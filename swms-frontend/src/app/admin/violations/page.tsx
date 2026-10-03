"use client";

import { useState } from "react";
import { PageHeader } from "@/components/ui/Primitives";
import { AsyncSection } from "@/components/ui/AsyncSection";
import { DataTable, Column } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ExportButton } from "@/components/ui/ExportButton";
import { ViolationStatusBadge } from "@/components/violations/ViolationStatusBadge";
import { CompleteViolationButton } from "@/components/violations/CompleteViolationButton";
import { formatResolvedDate } from "@/lib/violation";
import { useApi } from "@/hooks/useApi";
import { api } from "@/lib/api";
import { Violation } from "@/lib/types";

type Filter = "all" | "active" | "completed";

export default function ViolationsPage() {
  const [filter, setFilter] = useState<Filter>("active");
  const query = useApi(() => api.violations(), []);
  const violations = query.data ?? [];
  const filtered = filter === "all" ? violations : violations.filter((v) => v.status === filter);

  const columns: Column<Violation>[] = [
    { header: "Household", accessor: (v) => (
        <span className="font-medium text-ink">{v.representative} <span className="stamp text-[10px] text-ink/40">{v.householdCode}</span></span>
      ) },
    { header: "Purok", accessor: (v) => v.purokName },
    { header: "Type", accessor: (v) => v.type },
    { header: "Date", accessor: (v) => v.date },
    { header: "Repeat offense", accessor: (v) => (v.isRepeat ? <StatusBadge status="violation" /> : "—") },
    { header: "Notes", accessor: (v) => <span className="text-ink/50">{v.notes}</span> },
    {
      header: "Status",
      accessor: (v) =>
        v.status === "completed" ? (
          <div>
            <ViolationStatusBadge status="completed" />
            <p className="mt-1 text-[10.5px] text-ink/45">
              {formatResolvedDate(v.resolvedAt)} · {v.resolvedByName ?? "—"}
            </p>
          </div>
        ) : (
          <ViolationStatusBadge status="active" />
        ),
    },
    {
      header: "Action",
      accessor: (v) =>
        v.status === "active" ? (
          <CompleteViolationButton violation={v} onCompleted={() => query.reload()} />
        ) : (
          <span className="text-ink/30">—</span>
        ),
    },
  ];

  return (
    <div>
      <PageHeader
        eyebrow={`${violations.length} recorded`}
        title="Violations"
        description="Improper segregation and repeat offenses. Missed collections are tracked in Trash logs."
        actions={<ExportButton filename="violations" rows={violations} />}
      />

      <div className="mb-4 flex gap-2">
        {(
          [
            { key: "active" as const, label: "Active" },
            { key: "completed" as const, label: "Completed" },
            { key: "all" as const, label: "All" },
          ]
        ).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`stamp rounded-lg border px-3 py-1.5 text-[11px] font-medium transition-colors ${
              filter === tab.key ? "border-pine bg-pine-tint text-pine-dark" : "border-line bg-paper text-ink/50 hover:text-ink"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <AsyncSection query={query}>
        {() => (
          <DataTable
            data={filtered}
            columns={columns}
            searchPlaceholder="Search by household, code, or type…"
            searchKeys={(v) => `${v.representative} ${v.householdCode} ${v.type}`}
            pageSize={10}
          />
        )}
      </AsyncSection>
    </div>
  );
}
