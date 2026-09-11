"use client";

import { useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/Primitives";
import { AsyncSection } from "@/components/ui/AsyncSection";
import { DataTable, Column } from "@/components/ui/DataTable";
import { ExportButton } from "@/components/ui/ExportButton";
import { useApi } from "@/hooks/useApi";
import { api } from "@/lib/api";
import { Household } from "@/lib/types";

const columns: Column<Household>[] = [
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
  { header: "Compliance", accessor: (h) => `${h.complianceRate}%` },
];

export default function HouseholdsPage() {
  const [purokFilter, setPurokFilter] = useState("all");
  const query = useApi(
    () => Promise.all([api.households(), api.puroks()]).then(([households, puroks]) => ({ households, puroks })),
    [],
  );

  const households = query.data?.households ?? [];
  const puroks = query.data?.puroks ?? [];
  const filtered = purokFilter === "all" ? households : households.filter((h) => h.purokId === purokFilter);

  return (
    <div>
      <PageHeader
        eyebrow={`${households.length} registered`}
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
                  compliance: h.complianceRate,
                }))}
              />
            )}
          </div>
        }
      />
      <AsyncSection query={query}>
        {() => (
          <DataTable
            data={filtered}
            columns={columns}
            searchPlaceholder="Search by name, code, or purok…"
            searchKeys={(h) => `${h.representative} ${h.code} ${h.purokName}`}
            pageSize={10}
          />
        )}
      </AsyncSection>
    </div>
  );
}
