"use client";

import { PageHeader } from "@/components/ui/Primitives";
import { AsyncSection } from "@/components/ui/AsyncSection";
import { DataTable, Column } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useApi } from "@/hooks/useApi";
import { api } from "@/lib/api";
import { TrashLog } from "@/lib/types";

const columns: Column<TrashLog>[] = [
  { header: "Date", accessor: (t) => t.date },
  { header: "Time", accessor: (t) => t.time },
  { header: "Collector", accessor: (t) => t.collector },
  { header: "Disposed by", accessor: (t) => (t.status === "missed" ? "—" : t.disposedBy === "owner" ? "Me" : "Someone on my behalf") },
  { header: "Status", accessor: (t) => <StatusBadge status={t.status} /> },
];

export default function ResidentTrashLogsPage() {
  const query = useApi(() => api.trashLogs(), []);
  return (
    <div>
      <PageHeader eyebrow="History" title="My trash logs" description="Every scan recorded for your household's collections." />
      <AsyncSection query={query}>
        {(logs) => <DataTable data={logs} columns={columns} pageSize={10} />}
      </AsyncSection>
    </div>
  );
}
