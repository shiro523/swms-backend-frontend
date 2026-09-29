"use client";

import { PageHeader } from "@/components/ui/Primitives";
import { AsyncSection } from "@/components/ui/AsyncSection";
import { DataTable, Column } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ExportButton } from "@/components/ui/ExportButton";
import type { XlsxColumn } from "@/lib/exportXlsx";
import { useApi } from "@/hooks/useApi";
import { api } from "@/lib/api";
import { Violation } from "@/lib/types";

const xlsxColumns: XlsxColumn<Violation>[] = [
  { header: "Household", accessor: (v) => v.representative },
  { header: "Household Code", accessor: (v) => v.householdCode },
  { header: "Household ID", accessor: (v) => v.householdId },
  { header: "Purok", accessor: (v) => v.purokName },
  { header: "Violation Type", accessor: (v) => v.type },
  { header: "Date", accessor: (v) => v.date },
  { header: "Repeat Offense", accessor: (v) => (v.isRepeat ? "Yes" : "No") },
  { header: "Notes", accessor: (v) => v.notes ?? "" },
];

const columns: Column<Violation>[] = [
  { header: "Household", accessor: (v) => (
      <span className="font-medium text-ink">{v.representative} <span className="stamp text-[10px] text-ink/40">{v.householdCode}</span></span>
    ) },
  { header: "Type", accessor: (v) => v.type },
  { header: "Date", accessor: (v) => v.date },
  { header: "Repeat offense", accessor: (v) => (v.isRepeat ? <StatusBadge status="violation" /> : "—") },
  { header: "Notes", accessor: (v) => <span className="text-ink/50">{v.notes}</span> },
];

export default function PurokLeaderViolationsPage() {
  const query = useApi(
    () =>
      Promise.all([api.puroks(), api.violations()]).then(([puroks, violations]) => ({
        purok: puroks[0],
        violations,
      })),
    [],
  );

  const violations = query.data?.violations ?? [];

  return (
    <div>
      <PageHeader
        eyebrow={query.data?.purok?.name ?? "Your purok"}
        title="Violations"
        description="Improper segregation, missed collections, and repeat offenses in your purok."
        actions={
          violations.length > 0 && (
            <ExportButton filename="my-violations" rows={violations} format="xlsx" columns={xlsxColumns} />
          )
        }
      />
      <AsyncSection query={query}>
        {({ violations }) => (
          <DataTable
            data={violations}
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
