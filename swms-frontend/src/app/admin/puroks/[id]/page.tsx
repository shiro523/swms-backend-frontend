"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Mail, ShieldCheck, Users } from "lucide-react";
import { Card, PageHeader } from "@/components/ui/Primitives";
import { AsyncSection } from "@/components/ui/AsyncSection";
import { EditPurokDialog } from "@/components/puroks/EditPurokDialog";
import { useApi } from "@/hooks/useApi";
import { api } from "@/lib/api";

export default function PurokDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const query = useApi(
    () =>
      Promise.all([api.puroks(), api.purokAccounts(id)]).then(([puroks, accounts]) => ({
        purok: puroks.find((p) => p.id === id),
        accounts,
      })),
    [id],
  );

  return (
    <div>
      <Link href="/admin/puroks" className="flex items-center gap-1.5 text-xs font-medium text-ink/50 hover:text-pine-dark">
        <ArrowLeft size={13} /> Back to puroks
      </Link>

      <AsyncSection query={query}>
        {({ purok, accounts }) => (
          <>
            <PageHeader
              eyebrow={purok ? `${purok.households} households` : ""}
              title={purok?.name ?? "Purok"}
              description={`Login accounts registered under ${purok?.name ?? "this purok"}.`}
              actions={
                purok && (
                  <EditPurokDialog
                    purok={purok}
                    leaderUsername={accounts.leader?.username ?? ""}
                    leaderEmail={accounts.leader?.email ?? ""}
                    onUpdated={() => query.reload()}
                  />
                )
              }
            />

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
              <Card className="p-5">
                <p className="text-sm font-semibold text-ink">Purok leader</p>
                {accounts.leader ? (
                  <div className="mt-3 space-y-2.5 text-sm text-ink/70">
                    <p className="flex items-center gap-2">
                      <ShieldCheck size={14} className="text-ink/40" /> {accounts.leader.name}
                      <span className="stamp text-[10px] text-ink/40">@{accounts.leader.username}</span>
                    </p>
                    <p className="flex items-center gap-2">
                      <Mail size={14} className="text-ink/40" /> {accounts.leader.email}
                    </p>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-ink/40">No leader account on file.</p>
                )}
              </Card>

              <Card className="p-5 xl:col-span-2">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                  <Users size={14} className="text-ink/40" /> Resident accounts
                </p>
                <p className="text-xs text-ink/50">Every resident login account belonging to a household in this purok.</p>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="stamp text-[10.5px] text-ink/40">
                        <th className="px-2 py-2 font-medium">Username</th>
                        <th className="px-2 py-2 font-medium">Name</th>
                        <th className="px-2 py-2 font-medium">Email</th>
                        <th className="px-2 py-2 font-medium">Household</th>
                      </tr>
                    </thead>
                    <tbody>
                      {accounts.residents.map((r) => (
                        <tr key={r.id} className="ledger-row">
                          <td className="px-2 py-2.5">{r.username}</td>
                          <td className="px-2 py-2.5 text-ink/70">{r.name}</td>
                          <td className="px-2 py-2.5 text-ink/50">{r.email}</td>
                          <td className="px-2 py-2.5 text-ink/50">{r.householdCode ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {accounts.residents.length === 0 && (
                    <p className="py-6 text-center text-sm text-ink/40">No resident accounts yet.</p>
                  )}
                </div>
              </Card>
            </div>
          </>
        )}
      </AsyncSection>
    </div>
  );
}
