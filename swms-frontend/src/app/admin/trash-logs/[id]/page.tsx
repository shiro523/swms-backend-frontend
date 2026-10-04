"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Phone, MapPin, CalendarDays, Clock, User, StickyNote } from "lucide-react";
import { Card, PageHeader } from "@/components/ui/Primitives";
import { AsyncSection } from "@/components/ui/AsyncSection";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useApi } from "@/hooks/useApi";
import { api } from "@/lib/api";

export default function TrashLogDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const query = useApi(
    () =>
      api.trashLog(id).then((log) =>
        api.household(log.householdId).then((household) => ({ log, household })),
      ),
    [id],
  );

  return (
    <div>
      <Link href="/admin/trash-logs" className="flex items-center gap-1.5 text-xs font-medium text-ink/50 hover:text-pine-dark">
        <ArrowLeft size={13} /> Back to trash logs
      </Link>

      <AsyncSection query={query}>
        {({ log, household }) => (
          <>
            <PageHeader
              eyebrow={log.householdCode}
              title={`Collection on ${log.date}`}
              description={`Recorded for ${log.representative} in ${log.purokName}.`}
              actions={<StatusBadge status={log.status} />}
            />

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <Card className="p-5">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-ink">Collection details</p>
                  <span className="stamp text-[10px] text-ink/40">{log.id}</span>
                </div>
                <div className="mt-3 space-y-2.5 text-sm text-ink/70">
                  <p className="flex items-center gap-2"><CalendarDays size={14} className="text-ink/40" /> {log.date}</p>
                  <p className="flex items-center gap-2"><Clock size={14} className="text-ink/40" /> {log.time}</p>
                  <p className="flex items-center gap-2"><User size={14} className="text-ink/40" /> Collector: {log.collector}</p>
                  <p className="flex items-center gap-2">
                    <User size={14} className="text-ink/40" />
                    Disposed by: {log.status === "missed" ? "— (no collection recorded)" : log.disposedBy === "owner" ? "Household Representative" : "Family Member / Other Person"}
                  </p>
                </div>

                {log.notes && (
                  <>
                    <p className="mt-5 text-sm font-semibold text-ink">Notes</p>
                    <p className="mt-2 flex items-start gap-2 text-sm text-ink/70">
                      <StickyNote size={14} className="mt-0.5 shrink-0 text-ink/40" /> {log.notes}
                    </p>
                  </>
                )}
              </Card>

              <Card className="p-5">
                <p className="text-sm font-semibold text-ink">Household</p>
                <div className="mt-3 space-y-2.5 text-sm text-ink/70">
                  <p className="font-medium text-ink">{household.representative} <span className="stamp ml-1 text-[10px] text-ink/40">{household.code}</span></p>
                  <p className="flex items-center gap-2"><MapPin size={14} className="text-ink/40" /> {household.address}</p>
                  <p className="flex items-center gap-2"><Phone size={14} className="text-ink/40" /> {household.contactNumber}</p>
                  <p className="text-ink/60">{household.purokName}</p>
                </div>
                <Link
                  href={`/admin/households/${household.id}`}
                  className="mt-4 inline-flex items-center text-xs font-medium text-pine-dark hover:underline"
                >
                  View full household record →
                </Link>
              </Card>
            </div>
          </>
        )}
      </AsyncSection>
    </div>
  );
}
