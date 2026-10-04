"use client";

import { useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/Primitives";
import { AsyncSection } from "@/components/ui/AsyncSection";
import { DataTable, Column } from "@/components/ui/DataTable";
import { ExportButton } from "@/components/ui/ExportButton";
import { useApi } from "@/hooks/useApi";
import { api } from "@/lib/api";
import { complianceLabel, complianceExportValue } from "@/lib/householdStatus";
import { restoreWindow, toPhDateOrDash } from "@/lib/dateTime";
import { Household } from "@/lib/types";

// "Removed on <date>" — 30-day recovery window measured from removedAt,
// mirroring the admin Puroks archived-list's exact daysSince/RESTORE_WINDOW
// pattern (see admin/puroks/[id]/page.tsx).
function recoveryStatus(removedAt: string | null) {
  if (!removedAt) return "—";
  const { canRestore, daysLeft } = restoreWindow(removedAt);
  if (!canRestore) return "Restore window passed";
  return `${daysLeft} day${daysLeft === 1 ? "" : "s"} left to restore`;
}

const activeColumns: Column<Household>[] = [
  {
    header: "Household",
    accessor: (h) => (
      <Link href={`/admin/households/${h.id}`} className="font-medium text-ink hover:text-pine-dark hover:underline">
        {h.representative}
        <span className="stamp ml-2 text-[10px] text-ink/40">{h.code}</span>
      </Link>
    ),
  },
  { header: "Purok", accessor: (h) => h.purokName },
  { header: "Members", accessor: (h) => h.members.length },
  { header: "Contact", accessor: (h) => h.contactNumber },
  { header: "Compliance", accessor: (h) => complianceLabel(h) },
];

const removedColumns: Column<Household>[] = [
  {
    header: "Household",
    accessor: (h) => (
      <Link href={`/admin/households/${h.id}`} className="font-medium text-ink hover:text-pine-dark hover:underline">
        {h.representative}
        <span className="stamp ml-2 text-[10px] text-ink/40">{h.code}</span>
      </Link>
    ),
  },
  { header: "Purok", accessor: (h) => h.purokName },
  { header: "Removed on", accessor: (h) => toPhDateOrDash(h.removedAt) },
  { header: "Reason", accessor: (h) => h.removalReason ?? "—" },
  { header: "Removed by", accessor: (h) => h.removedByName ?? "—" },
  { header: "Recovery", accessor: (h) => recoveryStatus(h.removedAt) },
];

export default function HouseholdsPage() {
  const [view, setView] = useState<"active" | "removed">("active");
  const [purokFilter, setPurokFilter] = useState("all");
  const query = useApi(
    () =>
      Promise.all([view === "active" ? api.households() : api.removedHouseholds(), api.puroks()]).then(
        ([households, puroks]) => ({ households, puroks }),
      ),
    [view],
  );

  const households = query.data?.households ?? [];
  const puroks = query.data?.puroks ?? [];
  const filtered = purokFilter === "all" ? households : households.filter((h) => h.purokId === purokFilter);

  return (
    <div>
      <PageHeader
        eyebrow={`${households.length} ${view === "active" ? "registered" : "removed"}`}
        title="Households"
        description="Every registered household, its purok assignment, and current standing. Households are registered by each purok's leader."
        actions={
          <div className="flex items-center gap-2">
            <select
              value={purokFilter}
              onChange={(e) => setPurokFilter(e.target.value)}
              className="rounded-lg border border-line bg-paper px-3 py-2 text-[13px] text-ink/70"
            >
              <option value="all">All puroks</option>
              {puroks.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            {filtered.length > 0 && (
              <ExportButton
                filename="households"
                rows={filtered.map((h) => ({
                  code: h.code,
                  representative: h.representative,
                  purok: h.purokName,
                  members: h.members.length,
                  contact: h.contactNumber,
                  compliance: complianceExportValue(h),
                }))}
              />
            )}
          </div>
        }
      />

      <div className="mb-4 flex gap-2">
        {[
          { key: "active" as const, label: "Active" },
          { key: "removed" as const, label: "Removed" },
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
        {() => (
          <DataTable
            data={filtered}
            columns={view === "active" ? activeColumns : removedColumns}
            searchPlaceholder="Search by name, code, or purok…"
            searchKeys={(h) => `${h.representative} ${h.code} ${h.purokName}`}
            pageSize={10}
          />
        )}
      </AsyncSection>
    </div>
  );
}
