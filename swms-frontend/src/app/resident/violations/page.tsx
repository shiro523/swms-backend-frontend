"use client";

import { AlertTriangle } from "lucide-react";
import { PageHeader, Card, EmptyState } from "@/components/ui/Primitives";
import { AsyncSection } from "@/components/ui/AsyncSection";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ViolationStatusBadge } from "@/components/violations/ViolationStatusBadge";
import { formatResolvedDate, VIOLATION_LIMIT } from "@/lib/violation";
import { useApi } from "@/hooks/useApi";
import { api } from "@/lib/api";
import type { Violation } from "@/lib/types";

function ViolationRow({ v }: { v: Violation }) {
  return (
    <div className="flex items-start gap-3 py-3">
      <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-clay-tint text-clay">
        <AlertTriangle size={15} />
      </span>
      <div className="flex-1">
        <p className="text-sm font-medium text-ink">{v.type}</p>
        <p className="text-xs text-ink/50">{v.notes}</p>
        <p className="stamp mt-1 text-[10px] text-ink/35">{v.date}</p>
        {v.status === "completed" && (
          <p className="stamp mt-1 text-[10px] text-ink/35">
            Completed {formatResolvedDate(v.resolvedAt)}
            {v.resolvedByName ? ` · by ${v.resolvedByName}` : ""}
          </p>
        )}
      </div>
      <div className="flex flex-col items-end gap-1.5">
        <ViolationStatusBadge status={v.status} />
        {v.isRepeat && <StatusBadge status="violation" />}
      </div>
    </div>
  );
}

export default function ResidentViolationsPage() {
  const query = useApi(() => api.violations(), []);

  return (
    <div>
      <PageHeader eyebrow="Compliance record" title="My violations" description="Segregation violations recorded for your household. Missed collections appear in My Trash Logs." />
      <AsyncSection query={query}>
        {(violations) => {
          const active = violations.filter((v) => v.status === "active");
          const completed = violations.filter((v) => v.status === "completed");

          if (violations.length === 0) {
            return <EmptyState title="No violations on record" description="Keep segregating properly to maintain a clean compliance record." />;
          }

          const atLimit = violations.length >= VIOLATION_LIMIT;
          return (
            <div className="space-y-4">
              <Card className={`p-5 ${atLimit ? "border-clay/40 bg-clay-tint/40" : ""}`}>
                <p className="text-xs font-medium uppercase tracking-wide text-ink/45">Violations on record</p>
                <p className="mt-1 font-[family-name:var(--font-display)] text-2xl font-semibold text-ink">
                  {violations.length} <span className="text-base font-medium text-ink/40">/ {VIOLATION_LIMIT}</span>
                </p>
                <p className={`mt-1 text-sm ${atLimit ? "text-clay" : "text-ink/55"}`}>
                  {atLimit
                    ? "Your household has reached the violation limit. The barangay may send you a consequence notice — check your notifications and coordinate with your purok leader."
                    : `Completed violations still count. At ${VIOLATION_LIMIT}, the barangay may send your household a consequence notice.`}
                </p>
              </Card>

              <Card className="p-5">
                <p className="text-sm font-semibold text-ink">Active violations</p>
                {active.length === 0 ? (
                  <p className="py-3 text-sm text-ink/40">No active violations — you&apos;re all caught up.</p>
                ) : (
                  <div className="mt-1 divide-y divide-line">
                    {active.map((v) => (
                      <ViolationRow key={v.id} v={v} />
                    ))}
                  </div>
                )}
              </Card>

              <Card className="p-5">
                <p className="text-sm font-semibold text-ink">Completed / complied history</p>
                {completed.length === 0 ? (
                  <p className="py-3 text-sm text-ink/40">No completed violations yet.</p>
                ) : (
                  <div className="mt-1 divide-y divide-line">
                    {completed.map((v) => (
                      <ViolationRow key={v.id} v={v} />
                    ))}
                  </div>
                )}
              </Card>
            </div>
          );
        }}
      </AsyncSection>
    </div>
  );
}
