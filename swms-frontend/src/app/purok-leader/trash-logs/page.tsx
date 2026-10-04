"use client";

import { PageHeader } from "@/components/ui/Primitives";
import { AsyncSection } from "@/components/ui/AsyncSection";
import { DataTable, Column } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ExportButton } from "@/components/ui/ExportButton";
import type { XlsxColumn } from "@/lib/exportXlsx";
import { useApi } from "@/hooks/useApi";
import { api } from "@/lib/api";
import { TrashLog } from "@/lib/types";

const DISPOSED_BY_LABEL: Record<TrashLog["disposedBy"], string> = {
  owner: "Household Representative",
  representative: "Family Member / Other Person",
};

const xlsxColumns: XlsxColumn<TrashLog>[] = [
  { header: "Household", accessor: (t) => t.representative },
  { header: "Household Code", accessor: (t) => t.householdCode },
  { header: "Household ID", accessor: (t) => t.householdId },
  { header: "Purok", accessor: (t) => t.purokName },
  { header: "Date", accessor: (t) => t.date },
  { header: "Time", accessor: (t) => t.time },
  { header: "Status", accessor: (t) => t.status },
  { header: "Disposed By", accessor: (t) => (t.status === "missed" ? "—" : DISPOSED_BY_LABEL[t.disposedBy]) },
  { header: "Collector", accessor: (t) => t.collector },
  { header: "Notes", accessor: (t) => t.notes ?? "" },
];

const columns: Column<TrashLog>[] = [
  { header: "Date", accessor: (t) => t.date },
  { header: "Time", accessor: (t) => t.time },
  { header: "Household", accessor: (t) => (
      <span className="font-medium text-ink">{t.representative} <span className="stamp text-[10px] text-ink/40">{t.householdCode}</span></span>
    ) },
  { header: "Collector", accessor: (t) => t.collector },
  { header: "Status", accessor: (t) => <StatusBadge status={t.status} /> },
];

export default function PurokLeaderTrashLogsPage() {
  const query = useApi(
    () =>
      Promise.all([api.puroks(), api.trashLogs()]).then(([puroks, trashLogs]) => ({
        purok: puroks[0],
        trashLogs,
      })),
    [],
  );

  const trashLogs = query.data?.trashLogs ?? [];

  return (
    <div>
      <PageHeader
        eyebrow={query.data?.purok?.name ?? "Your purok"}
        title="Trash logs"
        description="Collection scans recorded for households in your purok."
        actions={
          trashLogs.length > 0 ? (
            <ExportButton filename="my-trash-logs" rows={trashLogs} format="xlsx" columns={xlsxColumns} />
          ) : undefined
        }
      />
      <AsyncSection query={query}>
        {({ trashLogs }) => (
          <DataTable
            data={trashLogs}
            columns={columns}
            searchPlaceholder="Search by household or code…"
            searchKeys={(t) => `${t.representative} ${t.householdCode}`}
            pageSize={10}
          />
        )}
      </AsyncSection>
    </div>
  );
}
