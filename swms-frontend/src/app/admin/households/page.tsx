"use client";

import Link from "next/link";
import { PageHeader } from "@/components/ui/Primitives";
import { AsyncSection } from "@/components/ui/AsyncSection";
import { DataTable, Column } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
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
  { header: "Payment", accessor: (h) => <StatusBadge status={h.paymentStatus} /> },
];

export default function HouseholdsPage() {
  const query = useApi(() => api.households(), []);
  const households = query.data ?? [];

  return (
    <div>
      <PageHeader
        eyebrow={`${households.length} registered`}
        title="Households"
        description="Every registered household, its purok assignment, and current standing. Households are registered by each purok's leader."
        actions={
          households.length > 0 && (
            <ExportButton
              filename="households"
              rows={households.map((h) => ({
                code: h.code,
                representative: h.representative,
                purok: h.purokName,
                members: h.members.length,
                contact: h.contactNumber,
                compliance: h.complianceRate,
                payment: h.paymentStatus,
              }))}
            />
          )
        }
      />
      <AsyncSection query={query}>
        {(households) => (
          <DataTable
            data={households}
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
