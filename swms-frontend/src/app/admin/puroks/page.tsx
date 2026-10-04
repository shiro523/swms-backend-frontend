"use client";

import { useState } from "react";
import Link from "next/link";
import { Users, Archive } from "lucide-react";
import { PageHeader, Card } from "@/components/ui/Primitives";
import { AsyncSection } from "@/components/ui/AsyncSection";
import { ExportButton } from "@/components/ui/ExportButton";
import { AddPurokDialog } from "@/components/puroks/AddPurokDialog";
import { useApi } from "@/hooks/useApi";
import { api } from "@/lib/api";

export default function PuroksPage() {
  const [view, setView] = useState<"active" | "archived">("active");
  const query = useApi(() => (view === "active" ? api.puroks() : api.archivedPuroks()), [view]);

  return (
    <div>
      <PageHeader
        eyebrow="Barangay structure"
        title="Puroks"
        description="Purok boundaries, assigned leaders, and household counts."
        actions={
          <>
            {query.data && <ExportButton filename="puroks" rows={query.data} />}
            {view === "active" && <AddPurokDialog onCreated={() => query.reload()} />}
          </>
        }
      />

      <div className="mb-4 flex gap-2">
        {[
          { key: "active" as const, label: "Active" },
          { key: "archived" as const, label: "Archived" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setView(tab.key)}
            className={`stamp rounded-lg border px-3 py-1.5 text-[11px] font-medium transition-colors ${
              view === tab.key ? "border-pine bg-pine-tint text-pine-dark" : "border-line bg-paper text-ink/50 hover:text-ink"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <AsyncSection query={query}>
        {(puroks) =>
          puroks.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-line py-16 text-center text-sm text-ink/40">
              {view === "active" ? "No active puroks." : "No archived puroks."}
            </div>
          ) : (
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
                      {p.archivedAt ? (
                        <span className="stamp flex items-center gap-1 rounded-full bg-clay-tint px-2.5 py-1 text-[10.5px] font-medium text-clay">
                          <Archive size={11} /> Archived
                        </span>
                      ) : (
                        <span
                          className={`stamp rounded-full px-2.5 py-1 text-[10.5px] font-medium ${
                            p.complianceRate === null
                              ? "bg-panel text-ink/50"
                              : p.complianceRate >= 90
                              ? "bg-pine-tint text-pine-dark"
                              : p.complianceRate >= 80
                              ? "bg-azure-tint text-azure"
                              : "bg-gold-tint text-gold"
                          }`}
                        >
                          {p.complianceRate === null ? "No records yet" : `${p.complianceRate}% compliant`}
                        </span>
                      )}
                    </div>
                    <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-sm">
                      <span className="text-ink/50">
                        Active households
                        {p.removedHouseholds > 0 && (
                          <span className="ml-1 text-xs text-ink/35">({p.removedHouseholds} removed)</span>
                        )}
                      </span>
                      <span className="font-[family-name:var(--font-display)] font-semibold text-ink">
                        {p.households}
                      </span>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          )
        }
      </AsyncSection>
    </div>
  );
}
