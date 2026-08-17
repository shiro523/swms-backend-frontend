"use client";

import Link from "next/link";
import { Users } from "lucide-react";
import { PageHeader, Card } from "@/components/ui/Primitives";
import { AsyncSection } from "@/components/ui/AsyncSection";
import { ExportButton } from "@/components/ui/ExportButton";
import { AddPurokDialog } from "@/components/puroks/AddPurokDialog";
import { useApi } from "@/hooks/useApi";
import { api } from "@/lib/api";

export default function PuroksPage() {
  const query = useApi(() => api.puroks(), []);

  return (
    <div>
      <PageHeader
        eyebrow="Barangay structure"
        title="Puroks"
        description="Purok boundaries, assigned leaders, and household counts."
        actions={
          <>
            {query.data && <ExportButton filename="puroks" rows={query.data} />}
            <AddPurokDialog onCreated={() => query.reload()} />
          </>
        }
      />

      <AsyncSection query={query}>
        {(puroks) => (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {puroks.map((p) => (
              <Link key={p.id} href={`/admin/puroks/${p.id}`} className="block transition-opacity hover:opacity-80">
                <Card className="p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-semibold text-ink">{p.name}</p>
                      <p className="mt-0.5 flex items-center gap-1.5 text-xs text-ink/50">
                        <Users size={12} /> Led by {p.leader}
                      </p>
                    </div>
                    <span
                      className={`stamp rounded-full px-2.5 py-1 text-[10.5px] font-medium ${
                        p.complianceRate >= 90
                          ? "bg-pine-tint text-pine-dark"
                          : p.complianceRate >= 80
                          ? "bg-azure-tint text-azure"
                          : "bg-gold-tint text-gold"
                      }`}
                    >
                      {p.complianceRate}% compliant
                    </span>
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-sm">
                    <span className="text-ink/50">Households</span>
                    <span className="font-[family-name:var(--font-display)] font-semibold text-ink">
                      {p.households}
                    </span>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </AsyncSection>
    </div>
  );
}
