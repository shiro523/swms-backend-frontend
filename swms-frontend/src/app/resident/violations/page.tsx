"use client";

import { AlertTriangle } from "lucide-react";
import { PageHeader, Card, EmptyState } from "@/components/ui/Primitives";
import { AsyncSection } from "@/components/ui/AsyncSection";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useApi } from "@/hooks/useApi";
import { api } from "@/lib/api";

export default function ResidentViolationsPage() {
  const query = useApi(() => api.violations(), []);

  return (
    <div>
      <PageHeader eyebrow="Compliance record" title="My violations" description="Segregation and collection violations recorded for your household." />
      <AsyncSection query={query}>
        {(violations) =>
          violations.length === 0 ? (
            <EmptyState title="No violations on record" description="Keep segregating properly to maintain a clean compliance record." />
          ) : (
            <Card className="p-5">
              <div className="divide-y divide-line">
                {violations.map((v) => (
                  <div key={v.id} className="flex items-start gap-3 py-3">
                    <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-clay-tint text-clay">
                      <AlertTriangle size={15} />
                    </span>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-ink">{v.type}</p>
                      <p className="text-xs text-ink/50">{v.notes}</p>
                      <p className="stamp mt-1 text-[10px] text-ink/35">{v.date}</p>
                    </div>
                    {v.isRepeat && <StatusBadge status="violation" />}
                  </div>
                ))}
              </div>
            </Card>
          )
        }
      </AsyncSection>
    </div>
  );
}
