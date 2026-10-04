"use client";

import { useEffect, useRef, useState } from "react";
import { PageHeader, StatCard, Card } from "@/components/ui/Primitives";
import { AsyncSection } from "@/components/ui/AsyncSection";
import { DataTable, Column } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ExportButton } from "@/components/ui/ExportButton";
import type { XlsxColumn } from "@/lib/exportXlsx";
import { RecordPaymentDialog } from "@/components/households/RecordPaymentDialog";
import { useApi } from "@/hooks/useApi";
import { api } from "@/lib/api";
import {
  ALL,
  UNRECOGNIZED_YEAR,
  describeYearMonth,
  matchesYearMonth,
  parsePeriod,
  periodYearOptions,
  toFileSlug,
} from "@/lib/paymentPeriod";
import { YearMonthFilter } from "@/components/payments/YearMonthFilter";
import { YearPaymentSummary } from "@/components/payments/YearPaymentSummary";
import { householdsAwaitingPayment, UNPAID_LIST_ANCHOR } from "@/lib/householdStatus";
import { Payment } from "@/lib/types";
import { Wallet, CircleCheck, CircleX, Search } from "lucide-react";

// The unpaid list gets a search box once it's longer than this.
const UNPAID_SEARCH_THRESHOLD = 5;

const xlsxColumns: XlsxColumn<Payment>[] = [
  { header: "Household", accessor: (p) => p.representative },
  { header: "Household Code", accessor: (p) => p.householdCode },
  { header: "Household ID", accessor: (p) => p.householdId },
  { header: "Purok", accessor: (p) => p.purokName },
  { header: "Period", accessor: (p) => p.period },
  { header: "Amount", accessor: (p) => p.amount, numFmt: '"₱"#,##0.00' },
  { header: "Date Paid", accessor: (p) => p.datePaid ?? "" },
  { header: "Status", accessor: (p) => p.status },
];

const columns: Column<Payment>[] = [
  { header: "Household", accessor: (p) => (
      <span className="font-medium text-ink">{p.representative} <span className="stamp text-[10px] text-ink/40">{p.householdCode}</span></span>
    ) },
  { header: "Period", accessor: (p) => p.period },
  { header: "Amount", accessor: (p) => `₱${p.amount.toFixed(2)}` },
  { header: "Date paid", accessor: (p) => p.datePaid ?? "—" },
  { header: "Status", accessor: (p) => <StatusBadge status={p.status} /> },
];

export default function PurokLeaderPaymentsPage() {
  // Year defaults to the current period's year (null = not chosen yet);
  // month to all twelve. Replaces the single period dropdown, which grew by
  // 12 entries every year.
  const [yearFilter, setYearFilter] = useState<string | null>(null);
  const [monthFilter, setMonthFilter] = useState(ALL);
  const query = useApi(
    () =>
      Promise.all([api.puroks(), api.households(), api.payments(), api.currentPaymentPeriod()]).then(
        ([puroks, households, payments, currentPeriod]) => ({
          purok: puroks[0],
          households,
          payments,
          currentPeriod: currentPeriod.period,
        }),
      ),
    [],
  );

  const households = query.data?.households ?? [];
  const payments = query.data?.payments ?? [];
  const currentPeriod = query.data?.currentPeriod ?? "";

  // Current-period status comes from the server (periodPaymentStatus):
  // "unpaid", or "new" for a household registered this month that hasn't
  // paid yet. Both are listed so a payment can be recorded for either.
  const unpaidHouseholds = householdsAwaitingPayment(households);
  const unpaidCount = unpaidHouseholds.filter((h) => h.periodPaymentStatus === "unpaid").length;
  const newCount = unpaidHouseholds.length - unpaidCount;

  const [unpaidSearch, setUnpaidSearch] = useState("");
  const unpaidQuery = unpaidSearch.trim().toLowerCase();
  const visibleUnpaid = unpaidQuery
    ? unpaidHouseholds.filter((h) => `${h.representative} ${h.code}`.toLowerCase().includes(unpaidQuery))
    : unpaidHouseholds;

  // Opened from the dashboard's "View all" (…/payments#unpaid): scroll to
  // the unpaid list once it has rendered (the data loads after navigation,
  // so the browser's own hash jump has nothing to land on yet).
  const unpaidListRef = useRef<HTMLDivElement | null>(null);
  const hasData = Boolean(query.data);
  useEffect(() => {
    if (hasData && window.location.hash === `#${UNPAID_LIST_ANCHOR}`) {
      unpaidListRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [hasData]);
  const collected = payments.filter((p) => p.status === "paid").reduce((sum, p) => sum + p.amount, 0);

  // Years come from the real payment records (plus the current year), so a
  // new year appears automatically once its first payment is recorded.
  const yearOptions = periodYearOptions(payments.map((p) => p.period), currentPeriod);
  const currentYear = parsePeriod(currentPeriod)?.year;
  const selectedYear = yearFilter ?? (currentYear !== undefined ? String(currentYear) : ALL);
  const summaryYear = selectedYear !== ALL && selectedYear !== UNRECOGNIZED_YEAR ? Number(selectedYear) : null;

  const filteredPayments = payments.filter((p) => matchesYearMonth(p.period, selectedYear, monthFilter));
  const selectionLabel = describeYearMonth(selectedYear, monthFilter);

  return (
    <div>
      <PageHeader
        eyebrow={query.data?.purok?.name ?? "Your purok"}
        title="Payments"
        description={currentPeriod ? `Monthly collection fee status for ${currentPeriod}.` : "Monthly collection fee status for households in your purok."}
        actions={
          payments.length > 0 ? (
            <ExportButton
              filename={`my-payments-${toFileSlug(selectionLabel).replace(/^payments-/, "")}`}
              rows={filteredPayments}
              format="xlsx"
              columns={xlsxColumns}
              disabled={filteredPayments.length === 0}
              disabledReason={`No payments for ${selectionLabel} to export.`}
            />
          ) : undefined
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Collected (all time)" value={`₱${collected.toLocaleString()}`} icon={Wallet} tone="pine" />
        <StatCard label="Paid this period" value={String(households.length - unpaidHouseholds.length)} icon={CircleCheck} tone="pine" />
        <StatCard
          label="Unpaid this period"
          value={String(unpaidCount)}
          sub={newCount > 0 ? `+ ${newCount} new (registered this month)` : undefined}
          icon={CircleX}
          tone="clay"
        />
      </div>

      <div className="mt-4">
        <AsyncSection query={query}>
          {() => (
            <>
              <div ref={unpaidListRef} id={UNPAID_LIST_ANCHOR} className="scroll-mt-24">
              <Card className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-ink">
                      Unpaid this period
                      {unpaidHouseholds.length > 0 && (
                        <span className="ml-2 rounded-full bg-clay-tint px-2 py-0.5 text-[11px] font-medium text-clay">
                          {unpaidHouseholds.length}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-ink/50">Households with no recorded payment for {currentPeriod || "the current period"}.</p>
                  </div>
                  {unpaidHouseholds.length > UNPAID_SEARCH_THRESHOLD && (
                    <label className="relative w-full sm:w-64">
                      <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/35" />
                      <input
                        value={unpaidSearch}
                        onChange={(e) => setUnpaidSearch(e.target.value)}
                        placeholder="Search unpaid households…"
                        aria-label="Search unpaid households"
                        className="w-full rounded-lg border border-line bg-paper py-2 pl-8 pr-3 text-[13px] text-ink outline-none focus:border-pine"
                      />
                    </label>
                  )}
                </div>
                {/* Scrolls inside the card once the list gets long, so the
                    payment history below stays within reach. */}
                <div className="mt-3 max-h-[360px] divide-y divide-line overflow-y-auto pr-1">
                  {visibleUnpaid.map((h) => (
                    <div key={h.id} className="flex items-center justify-between py-2.5 text-sm">
                      <div>
                        <p className="font-medium text-ink">{h.representative}</p>
                        <p className="text-xs text-ink/45">{h.code}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={h.periodPaymentStatus} />
                        <RecordPaymentDialog householdId={h.id} onRecorded={() => query.reload()} />
                      </div>
                    </div>
                  ))}
                  {unpaidHouseholds.length === 0 && (
                    <p className="py-3 text-sm text-ink/40">All households are paid up for {currentPeriod || "this period"}.</p>
                  )}
                  {unpaidHouseholds.length > 0 && visibleUnpaid.length === 0 && (
                    <p className="py-3 text-sm text-ink/40">No unpaid household matches “{unpaidSearch}”.</p>
                  )}
                </div>
              </Card>
              </div>

              {summaryYear !== null && (
                <div className="mt-4">
                  <YearPaymentSummary
                    payments={payments}
                    year={summaryYear}
                    currentPeriod={currentPeriod}
                    selectedMonth={monthFilter}
                    onSelectMonth={setMonthFilter}
                  />
                </div>
              )}

              <div className="mt-4 flex justify-end">
                <YearMonthFilter
                  years={yearOptions}
                  year={selectedYear}
                  month={monthFilter}
                  onYearChange={setYearFilter}
                  onMonthChange={setMonthFilter}
                />
              </div>

              <div className="mt-2">
                <p className="mb-2 text-xs text-ink/50">
                  Showing <span className="font-semibold text-ink/70">{filteredPayments.length}</span> payment
                  {filteredPayments.length === 1 ? "" : "s"} · {selectionLabel}
                </p>
                <DataTable
                  data={filteredPayments}
                  emptyMessage={`No payments for ${selectionLabel}.`}
                  columns={columns}
                  searchPlaceholder="Search by household or code…"
                  searchKeys={(p) => `${p.representative} ${p.householdCode} ${p.householdId}`}
                  pageSize={10}
                />
              </div>
            </>
          )}
        </AsyncSection>
      </div>
    </div>
  );
}
