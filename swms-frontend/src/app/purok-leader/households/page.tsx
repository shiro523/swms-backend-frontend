"use client";

import Link from "next/link";
import { PageHeader } from "@/components/ui/Primitives";
import { AsyncSection } from "@/components/ui/AsyncSection";
import { DataTable, Column } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ExportButton } from "@/components/ui/ExportButton";
import { RegisterHouseholdDialog } from "@/components/households/RegisterHouseholdDialog";
import { useApi } from "@/hooks/useApi";
import { api } from "@/lib/api";
import { complianceLabel, complianceExportValue } from "@/lib/householdStatus";
import { Household } from "@/lib/types";

const columns: Column<Household>[] = [
  { header: "Household", accessor: (h) => (
      <Link href={`/purok-leader/households/${h.id}`} className="font-medium text-ink hover:text-pine-dark hover:underline">
        {h.representative}
        <span className="stamp ml-2 text-[10px] text-ink/40">{h.code}</span>
      </Link>
    ) },
  { header: "Members", accessor: (h) => h.members.length },
  { header: "Contact", accessor: (h) => h.contactNumber },
  { header: "Compliance", accessor: (h) => complianceLabel(h) },
  { header: "Payment", accessor: (h) => <StatusBadge status={h.periodPaymentStatus} /> },
];

const searchKeys = (h: Household) => `${h.representative} ${h.code}`;

export default function PurokLeaderHouseholdsPage() {
  const query = useApi(
    () =>
      Promise.all([api.puroks(), api.households()]).then(([puroks, households]) => ({
        purok: puroks[0],
        households,
      })),
    [],
  );

  const households = query.data?.households ?? [];
  const exportRows = households.map((h) => ({
    code: h.code,
    representative: h.representative,
    members: h.members.length,
    contact: h.contactNumber,
    compliance: complianceExportValue(h),
    payment: h.periodPaymentStatus,
  }));

  return (
    <div>
      <PageHeader
        eyebrow={query.data?.purok?.name ?? "Your purok"}
        title="Households"
        description="Households registered under your purok."
        actions={
          <>
            {households.length > 0 && <ExportButton filename="my-households" rows={exportRows} />}
            <RegisterHouseholdDialog triggerLabel="Register resident" onCreated={() => query.reload()} />
          </>
        }
      />
      <AsyncSection query={query}>
        {({ households }) => (
          <DataTable
            data={households}
            columns={columns}
            searchPlaceholder="Search by name or code…"
            searchKeys={searchKeys}
            pageSize={10}
          />
        )}
      </AsyncSection>
    </div>
  );
}
