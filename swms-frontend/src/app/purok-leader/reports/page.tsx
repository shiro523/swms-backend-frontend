"use client";

import { FileBarChart, ScrollText, Wallet, LucideIcon } from "lucide-react";
import { PageHeader, Card } from "@/components/ui/Primitives";
import { AsyncSection } from "@/components/ui/AsyncSection";
import { exportToCsv } from "@/lib/exportCsv";
import { useApi } from "@/hooks/useApi";
import { api } from "@/lib/api";

export default function PurokLeaderReportsPage() {
  const query = useApi(
    () =>
      Promise.all([api.puroks(), api.trashLogs(), api.payments()]).then(
        ([puroks, trashLogs, payments]) => ({ purok: puroks[0], trashLogs, payments }),
      ),
    [],
  );

  return (
    <div>
      <PageHeader
        eyebrow={query.data?.purok?.name ?? "Your purok"}
        title="Reports"
        description="Export reports for households in your purok."
      />
      <AsyncSection query={query}>
        {({ trashLogs, payments }) => {
          const reports: {
            key: string;
            title: string;
            description: string;
            icon: LucideIcon;
            rows: object[];
          }[] = [
            { key: "my-trash-logs", title: "Trash Logs Report", description: "Collection logs for your purok.", icon: ScrollText, rows: trashLogs },
            { key: "my-payments", title: "Payment Collection Report", description: "Fee status for your households.", icon: Wallet, rows: payments },
          ];

          return (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {reports.map((r) => (
                <Card key={r.key} className="flex flex-col p-5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-pine-tint text-pine-dark">
                    <r.icon size={17} />
                  </span>
                  <p className="mt-3 text-sm font-semibold text-ink">{r.title}</p>
                  <p className="mt-1 flex-1 text-xs leading-relaxed text-ink/55">{r.description}</p>
                  <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
                    <span className="stamp text-[10.5px] text-ink/40">{r.rows.length} records</span>
                    <button
                      onClick={() => exportToCsv(r.key, r.rows)}
                      className="flex items-center gap-1.5 text-xs font-medium text-pine-dark hover:underline"
                    >
                      <FileBarChart size={13} />
                      Export
                    </button>
                  </div>
                </Card>
              ))}
            </div>
          );
        }}
      </AsyncSection>
    </div>
  );
}
