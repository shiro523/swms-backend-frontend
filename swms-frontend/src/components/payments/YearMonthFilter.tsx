"use client";

import { ALL, MONTH_LABELS, UNRECOGNIZED_YEAR } from "@/lib/paymentPeriod";

const selectClass = "rounded-lg border border-line bg-paper px-3 py-2 text-[13px] text-ink/70 disabled:opacity-50";

// Year + month filter for payment periods ("Month YYYY"). Replaces a single
// period dropdown that grew by 12 entries every year.
export function YearMonthFilter({
  years,
  year,
  month,
  onYearChange,
  onMonthChange,
}: {
  years: string[];
  year: string;
  month: string;
  onYearChange: (year: string) => void;
  onMonthChange: (month: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select aria-label="Year" value={year} onChange={(e) => onYearChange(e.target.value)} className={selectClass}>
        <option value={ALL}>All years</option>
        {years.map((y) => (
          <option key={y} value={y}>
            {y === UNRECOGNIZED_YEAR ? "No year (needs correction)" : y}
          </option>
        ))}
      </select>
      <select
        aria-label="Month"
        value={month}
        onChange={(e) => onMonthChange(e.target.value)}
        disabled={year === UNRECOGNIZED_YEAR}
        className={selectClass}
      >
        <option value={ALL}>All months</option>
        {MONTH_LABELS.map((label, index) => (
          <option key={label} value={String(index)}>
            {label}
          </option>
        ))}
      </select>
    </div>
  );
}
