"use client";

import clsx from "clsx";
import { Card } from "@/components/ui/Primitives";
import { MONTH_LABELS, parsePeriod } from "@/lib/paymentPeriod";
import type { Payment } from "@/lib/types";

// Month-by-month totals for one year: amount collected and how many
// households paid, by payment period. Clicking a month filters the table.
export function YearPaymentSummary({
  payments,
  year,
  currentPeriod,
  selectedMonth,
  onSelectMonth,
}: {
  payments: Payment[];
  year: number;
  currentPeriod: string;
  selectedMonth: string;
  onSelectMonth: (month: string) => void;
}) {
  const months = MONTH_LABELS.map(() => ({ collected: 0, households: new Set<string>() }));
  for (const p of payments) {
    const parsed = parsePeriod(p.period);
    if (p.status !== "paid" || !parsed || parsed.year !== year) continue;
    months[parsed.month].collected += p.amount;
    months[parsed.month].households.add(p.householdId);
  }
  const yearTotal = months.reduce((sum, m) => sum + m.collected, 0);
  const current = parsePeriod(currentPeriod);

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-semibold text-ink">{year} by month</p>
        <p className="text-xs text-ink/50">
          Total collected: <span className="font-semibold text-ink">₱{yearTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
        </p>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        {months.map((m, index) => {
          const isCurrent = current?.year === year && current.month === index;
          const isFuture = current !== null && (year > current.year || (year === current.year && index > current.month));
          const isSelected = selectedMonth === String(index);
          return (
            <button
              key={MONTH_LABELS[index]}
              type="button"
              onClick={() => onSelectMonth(isSelected ? "all" : String(index))}
              aria-pressed={isSelected}
              className={clsx(
                "rounded-xl border px-3 py-2 text-left transition-colors",
                isSelected ? "border-pine bg-pine-tint" : "border-line bg-paper hover:border-pine/40",
                isFuture && !isSelected && "opacity-50",
              )}
            >
              <p className="flex items-center justify-between text-xs font-medium text-ink/60">
                {MONTH_LABELS[index].slice(0, 3)}
                {isCurrent && <span className="stamp text-[9px] text-pine">Now</span>}
              </p>
              <p className="mt-0.5 text-sm font-semibold text-ink">₱{m.collected.toLocaleString()}</p>
              <p className="text-[11px] text-ink/45">
                {m.households.size} {m.households.size === 1 ? "household" : "households"}
              </p>
            </button>
          );
        })}
      </div>
    </Card>
  );
}
