"use client";

import { useState } from "react";
import { PageHeader, StatCard } from "@/components/ui/Primitives";
import { AsyncSection } from "@/components/ui/AsyncSection";
import { DataTable, Column } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ExportButton } from "@/components/ui/ExportButton";
import { useApi } from "@/hooks/useApi";
import { api } from "@/lib/api";
import {
  ALL,
  UNRECOGNIZED_YEAR,
  describeYearMonth,
  matchesYearMonth,
  parsePeriod,
  toFileSlug,
  periodYearOptions,
} from "@/lib/paymentPeriod";
import { householdsAwaitingPayment } from "@/lib/householdStatus";
import { YearMonthFilter } from "@/components/payments/YearMonthFilter";
import { YearPaymentSummary } from "@/components/payments/YearPaymentSummary";
import { CorrectPaymentPeriodDialog } from "@/components/payments/CorrectPaymentPeriodDialog";
import { Payment, PaymentStatus } from "@/lib/types";
import type { XlsxColumn } from "@/lib/exportXlsx";

const xlsxColumns: XlsxColumn<Payment>[] = [
  { header: "Household", accessor: (p) => p.representative },
  { header: "Household Code", accessor: (p) => p.householdCode },
  { header: "Purok", accessor: (p) => p.purokName },
  { header: "Period", accessor: (p) => p.period },
  { header: "Amount", accessor: (p) => (p.status === "unpaid" ? "" : p.amount), numFmt: '"₱"#,##0.00' },
  { header: "Date Paid", accessor: (p) => p.datePaid ?? "" },
  { header: "Status", accessor: (p) => p.status },
];
import { Wallet, CircleCheck, CircleX } from "lucide-react";

// newHouseholdIds: placeholder Unpaid-tab rows for households registered
// this month show "new" instead of "unpaid".
function buildColumns(onCorrected: () => void, newHouseholdIds: Set<string>): Column<Payment>[] {
  return [
    { header: "Household", accessor: (p) => (
        <span className="font-medium text-ink">{p.representative} <span className="stamp text-[10px] text-ink/40">{p.householdCode}</span></span>
      ) },
    { header: "Purok", accessor: (p) => p.purokName },
    { header: "Period", accessor: (p) => p.period },
    { header: "Amount", accessor: (p) => (p.status === "unpaid" ? "—" : `₱${p.amount.toFixed(2)}`) },
    { header: "Date paid", accessor: (p) => p.datePaid ?? "—" },
    {
      header: "Status",
      accessor: (p) => (
        <StatusBadge status={p.status === "unpaid" && newHouseholdIds.has(p.householdId) ? "new" : p.status} />
      ),
    },
    {
      header: "Actions",
      // Synthetic "Unpaid" placeholder rows (id starts with "unpaid-") have
      // no real Payment to correct — only real, already-paid rows get the
      // action.
      accessor: (p) => (p.status === "unpaid" ? null : <CorrectPaymentPeriodDialog payment={p} onCorrected={onCorrected} />),
    },
  ];
}

const FILTERS: { label: string; value: PaymentStatus | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Paid", value: "paid" },
  { label: "Unpaid", value: "unpaid" },
];

export default function PaymentsPage() {
  const [filter, setFilter] = useState<PaymentStatus | "all">("all");
  const [purokFilter, setPurokFilter] = useState("all");
  // Year defaults to the current period's year (null = not chosen yet);
  // month to all twelve. Replaces the single period dropdown, which grew by
  // 12 entries every year.
  const [yearFilter, setYearFilter] = useState<string | null>(null);
  const [monthFilter, setMonthFilter] = useState(ALL);
  const query = useApi(
    () =>
      Promise.all([api.households(), api.payments(), api.currentPaymentPeriod(), api.puroks()]).then(
        ([households, payments, currentPeriod, puroks]) => ({
          households,
          payments,
          currentPeriod: currentPeriod.period,
          puroks,
        }),
      ),
    [],
  );
  const allHouseholds = query.data?.households ?? [];
  const allPayments = query.data?.payments ?? [];
  const currentPeriod = query.data?.currentPeriod ?? "";
  const puroks = query.data?.puroks ?? [];

  // Purok scopes both the household list and the payment rows together, so
  // the stat cards (paid/unpaid this period) and the table always agree on
  // which households are in view. "All puroks" deliberately does NOT filter
  // payments by the active-household list: api.households() leaves out
  // soft-removed households, but their payments are still official history
  // and must stay visible here.
  const households = purokFilter === "all" ? allHouseholds : allHouseholds.filter((h) => h.purokId === purokFilter);
  const householdIdsInScope = new Set(households.map((h) => h.id));
  const payments =
    purokFilter === "all" ? allPayments : allPayments.filter((p) => householdIdsInScope.has(p.householdId));

  // Years come from the real payment records (plus the current year), so a
  // new year appears automatically once its first payment is recorded.
  const yearOptions = periodYearOptions(allPayments.map((p) => p.period), currentPeriod);
  const currentYear = parsePeriod(currentPeriod)?.year;
  const selectedYear = yearFilter ?? (currentYear !== undefined ? String(currentYear) : ALL);
  const summaryYear = selectedYear !== ALL && selectedYear !== UNRECOGNIZED_YEAR ? Number(selectedYear) : null;

  // Paid/unpaid for the current billing period, derived from actual Payment
  // records — never from Payment.status (always "paid", not period-aware)
  // or Household.paymentStatus (means "ever paid," not "paid this period").
  // Scoped to the purok filter (not the period filter — Paid/Unpaid is
  // always about the current period, independent of which period the table
  // below is being browsed for).
  // Uses the server's periodPaymentStatus (paid / unpaid / new) — the same
  // status the households lists and the purok leader pages show. "new" =
  // registered this month, not paid yet: listed under Unpaid (a payment can
  // be recorded for it) but counted separately.
  const unpaidHouseholds = householdsAwaitingPayment(households);
  const paidHouseholds = households.filter((h) => h.periodPaymentStatus === "paid");
  const paidHouseholdIds = new Set(paidHouseholds.map((h) => h.id));
  const unpaidCount = unpaidHouseholds.filter((h) => h.periodPaymentStatus === "unpaid").length;
  const newCount = unpaidHouseholds.length - unpaidCount;
  const newHouseholdIds = new Set(unpaidHouseholds.filter((h) => h.periodPaymentStatus === "new").map((h) => h.id));

  // The Unpaid tab can't show a real Payment row — by definition, an unpaid
  // household has no payment record for the current period, so the only
  // rows that could exist for them are historical (from an earlier period,
  // when they WERE paid), which would misleadingly show a "Paid" status
  // badge under an "Unpaid" heading. Synthesizing one placeholder row per
  // unpaid household — built from data already fetched (unpaidHouseholds),
  // never a fabricated record — makes the tab show exactly what's true
  // ("no payment recorded for this period") without ever surfacing a stale
  // paid record in the wrong context. All/Paid are unaffected and still
  // show real Payment rows, including full history.
  const unpaidRows: Payment[] = unpaidHouseholds.map((h) => ({
    id: `unpaid-${h.id}`,
    householdId: h.id,
    householdCode: h.code,
    representative: h.representative,
    purokName: h.purokName,
    period: currentPeriod,
    amount: 0,
    status: "unpaid",
  }));

  // The year/month filter only applies to real payment rows (All/Paid) —
  // the Unpaid tab's synthetic rows have one fixed meaning ("no payment for
  // the current period yet") that a past-period filter can't meaningfully
  // narrow, so it's left untouched there.
  const periodScoped = (rows: Payment[]) => rows.filter((p) => matchesYearMonth(p.period, selectedYear, monthFilter));

  const filtered =
    filter === "all"
      ? periodScoped(payments)
      : filter === "paid"
        ? periodScoped(payments.filter((p) => paidHouseholdIds.has(p.householdId)))
        : unpaidRows;

  const collected = payments.filter((p) => p.status === "paid").reduce((sum, p) => sum + p.amount, 0);
  const periodEyebrow = currentPeriod ? `${currentPeriod} collection` : "Collection";

  // What the table (and the export) currently shows. The Unpaid tab is
  // always the current period, so the year/month filter doesn't apply to it.
  const selectionLabel =
    filter === "unpaid" ? `Unpaid · ${currentPeriod}` : describeYearMonth(selectedYear, monthFilter);
  const collectedInSelection = periodScoped(payments)
    .filter((p) => p.status === "paid")
    .reduce((sum, p) => sum + p.amount, 0);
  // e.g. payments-november-2026, payments-paid-2026, payments-unpaid-october-2026
  const selectionSlug = toFileSlug(describeYearMonth(selectedYear, monthFilter)).replace(/^payments-/, "");
  const exportName =
    filter === "unpaid"
      ? `payments-unpaid-${toFileSlug(currentPeriod)}`
      : `payments-${filter === "paid" ? "paid-" : ""}${selectionSlug}`;

  return (
    <div>
      <PageHeader
        eyebrow={periodEyebrow}
        title="Payments"
        description="Monthly waste collection fee status across all households."
        actions={
          <ExportButton
            filename={exportName}
            rows={filtered}
            format="xlsx"
            columns={xlsxColumns}
            disabled={filtered.length === 0}
            disabledReason={`No records for ${selectionLabel} to export.`}
          />
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label={`Collected · ${describeYearMonth(selectedYear, monthFilter)}`}
          value={`₱${collectedInSelection.toLocaleString()}`}
          sub={`₱${collected.toLocaleString()} collected all time`}
          icon={Wallet}
          tone="pine"
        />
        <StatCard label={`Paid · ${currentPeriod || "this period"}`} value={String(paidHouseholds.length)} icon={CircleCheck} tone="pine" />
        <StatCard
          label={`Unpaid · ${currentPeriod || "this period"}`}
          value={String(unpaidCount)}
          sub={newCount > 0 ? `+ ${newCount} new (registered this month)` : undefined}
          icon={CircleX}
          tone="clay"
        />
      </div>

      <div className="my-4 flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`stamp rounded-lg border px-3 py-1.5 text-[11px] font-medium transition-colors ${
              filter === f.value
                ? "border-pine bg-pine-tint text-pine-dark"
                : "border-line bg-paper text-ink/50 hover:text-ink"
            }`}
          >
            {f.label}
          </button>
        ))}

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

        <YearMonthFilter
          years={yearOptions}
          year={selectedYear}
          month={monthFilter}
          onYearChange={setYearFilter}
          onMonthChange={setMonthFilter}
          disabled={filter === "unpaid"}
        />
        {filter === "unpaid" && (
          <span className="text-xs text-ink/45">The Unpaid tab always shows the current period ({currentPeriod}).</span>
        )}
      </div>

      {summaryYear !== null && filter !== "unpaid" && (
        <div className="mb-4">
          <YearPaymentSummary
            payments={payments}
            year={summaryYear}
            currentPeriod={currentPeriod}
            selectedMonth={monthFilter}
            onSelectMonth={setMonthFilter}
          />
        </div>
      )}

      <p className="mb-2 text-xs text-ink/50">
        Showing <span className="font-semibold text-ink/70">{filtered.length}</span>{" "}
        {filter === "unpaid" ? "unpaid household" : "payment"}{filtered.length === 1 ? "" : "s"} · {selectionLabel}
      </p>

      <AsyncSection query={query}>
        {() => (
          <DataTable
            data={filtered}
            emptyMessage={filter === "unpaid" ? `Every household has paid for ${currentPeriod}.` : `No payments for ${selectionLabel}.`}
            columns={buildColumns(() => query.reload(), newHouseholdIds)}
            searchPlaceholder="Search by household name, code, or ID…"
            searchKeys={(p) => `${p.representative} ${p.householdCode} ${p.householdId}`}
            pageSize={10}
          />
        )}
      </AsyncSection>
    </div>
  );
}
