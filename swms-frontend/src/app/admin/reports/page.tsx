"use client";

import { useState } from "react";
import { FileBarChart, ScrollText, AlertTriangle, Wallet, Home, MapPinned, LucideIcon } from "lucide-react";
import { PageHeader, Card } from "@/components/ui/Primitives";
import { AsyncSection } from "@/components/ui/AsyncSection";
import { ReportPreviewModal } from "@/components/reports/ReportPreviewModal";
import { exportToCsv } from "@/lib/exportCsv";
import { useApi } from "@/hooks/useApi";
import { api } from "@/lib/api";
import { complianceExportValue } from "@/lib/householdStatus";

export default function ReportsPage() {
  const [viewingKey, setViewingKey] = useState<string | null>(null);
  const query = useApi(
    () =>
      Promise.all([
        api.trashLogs(),
        api.violations(),
        api.payments(),
        api.households(),
        api.puroks(),
      ]).then(([trashLogs, violations, payments, households, puroks]) => ({
        trashLogs,
        violations,
        payments,
        households,
        puroks,
      })),
    [],
  );

  return (
    <div>
      <PageHeader
        eyebrow="Barangay-wide"
        title="Reports"
        description="Generate and export reports for record-keeping and decision-making."
      />

      <AsyncSection query={query}>
        {({ trashLogs, violations, payments, households, puroks }) => {
          const reports: {
            key: string;
            title: string;
            description: string;
            icon: LucideIcon;
            rows: object[];
          }[] = [
            { key: "trash-logs", title: "Trash Logs Report", description: "All collection scans with compliance status by household and purok.", icon: ScrollText, rows: trashLogs },
            { key: "violations", title: "Violation Report", description: "Improper segregation violations and repeat offenders.", icon: AlertTriangle, rows: violations },
            { key: "payments", title: "Payment Collection Report", description: "Monthly fee status, amounts collected, and outstanding balances.", icon: Wallet, rows: payments },
            {
              key: "households",
              title: "Household Report",
              description: "Registered households, compliance rate, and payment standing.",
              icon: Home,
              rows: households.map((h) => ({
                code: h.code,
                representative: h.representative,
                purok: h.purokName,
                members: h.members.length,
                compliance: complianceExportValue(h),
                payment: h.periodPaymentStatus,
              })),
            },
            { key: "puroks", title: "Purok Report", description: "Household counts and compliance rate per purok.", icon: MapPinned, rows: puroks },
          ];

          const viewing = reports.find((r) => r.key === viewingKey) ?? null;

          return (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {reports.map((r) => (
                  <Card
                    key={r.key}
                    onClick={() => setViewingKey(r.key)}
                    className="flex cursor-pointer flex-col p-5 transition-colors hover:border-pine/40"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-pine-tint text-pine-dark">
                      <r.icon size={17} />
                    </span>
                    <p className="mt-3 text-sm font-semibold text-ink">{r.title}</p>
                    <p className="mt-1 flex-1 text-xs leading-relaxed text-ink/55">{r.description}</p>
                    <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
                      <span className="stamp text-[10.5px] text-ink/40">
                        {r.rows.length > 0 ? `${r.rows.length} records` : "No records yet"}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          exportToCsv(r.key, r.rows);
                        }}
                        disabled={r.rows.length === 0}
                        className="flex items-center gap-1.5 text-xs font-medium text-pine-dark hover:underline disabled:cursor-not-allowed disabled:text-ink/30 disabled:no-underline"
                      >
                        <FileBarChart size={13} />
                        Export
                      </button>
                    </div>
                  </Card>
                ))}
              </div>

              {viewing && (
                <ReportPreviewModal
                  open
                  onClose={() => setViewingKey(null)}
                  title={viewing.title}
                  rows={viewing.rows}
                />
              )}
            </>
          );
        }}
      </AsyncSection>
    </div>
  );
}
