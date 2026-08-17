"use client";

import { FileBarChart, ScrollText, AlertTriangle, Wallet, Home, MapPinned, LucideIcon } from "lucide-react";
import { PageHeader, Card } from "@/components/ui/Primitives";
import { AsyncSection } from "@/components/ui/AsyncSection";
import { exportToCsv } from "@/lib/exportCsv";
import { useApi } from "@/hooks/useApi";
import { api } from "@/lib/api";

export default function ReportsPage() {
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
            { key: "violations", title: "Violation Report", description: "Improper segregation, missed collections, and repeat offenders.", icon: AlertTriangle, rows: violations },
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
                compliance: h.complianceRate,
                payment: h.paymentStatus,
              })),
            },
            { key: "puroks", title: "Purok Report", description: "Household counts and compliance rate per purok.", icon: MapPinned, rows: puroks },
          ];

          return (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
