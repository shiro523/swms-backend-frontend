"use client";

import { PageHeader } from "@/components/ui/Primitives";
import { AsyncSection } from "@/components/ui/AsyncSection";
import { DataTable, Column } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ExportButton } from "@/components/ui/ExportButton";
import { useApi } from "@/hooks/useApi";
import { api } from "@/lib/api";
import { Violation } from "@/lib/types";

const columns: Column<Violation>[] = [
  { header: "Household", accessor: (v) => (
      <span className="font-medium text-ink">{v.representative} <span className="stamp text-[10px] text-ink/40">{v.householdCode}</span></span>
    ) },
  { header: "Purok", accessor: (v) => v.purokName },
  { header: "Type", accessor: (v) => v.type },
  { header: "Date", accessor: (v) => v.date },
  { header: "Repeat offense", accessor: (v) => (v.isRepeat ? <StatusBadge status="violation" /> : "—") },
  { header: "Notes", accessor: (v) => <span className="text-ink/50">{v.notes}</span> },
];

export default function ViolationsPage() {
  const query = useApi(() => api.violations(), []);
  const violations = query.data ?? [];

  return (
    <div>
      <PageHeader
        eyebrow={`${violations.length} recorded`}
        title="Violations"
        description="Improper segregation, missed collections, and repeat offenses."
        actions={<ExportButton filename="violations" rows={violations} />}
      />
      <AsyncSection query={query}>
        {(data) => (
          <DataTable
            data={data}
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
