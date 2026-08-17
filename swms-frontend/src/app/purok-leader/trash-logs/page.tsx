"use client";

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
        actions={trashLogs.length > 0 ? <ExportButton filename="my-trash-logs" rows={trashLogs} /> : undefined}
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
