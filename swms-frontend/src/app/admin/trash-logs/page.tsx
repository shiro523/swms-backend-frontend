"use client";

import { useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/Primitives";
import { AsyncSection } from "@/components/ui/AsyncSection";
import { DataTable, Column } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ExportButton } from "@/components/ui/ExportButton";
import { useApi } from "@/hooks/useApi";
import { api } from "@/lib/api";
import { TrashLog } from "@/lib/types";

const columns: Column<TrashLog>[] = [
  { header: "Date", accessor: (t) => t.date },
  { header: "Time", accessor: (t) => t.time },
  { header: "Household", accessor: (t) => (
      <Link href={`/admin/trash-logs/${t.id}`} className="font-medium text-ink hover:text-pine-dark hover:underline">
        {t.representative}
        <span className="stamp ml-2 text-[10px] text-ink/40">{t.householdCode}</span>
      </Link>
    ) },
  { header: "Purok", accessor: (t) => t.purokName },
  { header: "Collector", accessor: (t) => t.collector },
  { header: "Disposed by", accessor: (t) => (t.status === "missed" ? "—" : t.disposedBy === "owner" ? "Owner" : "Representative") },
  { header: "Status", accessor: (t) => <StatusBadge status={t.status} /> },
];

// Local calendar date as YYYY-MM-DD — deliberately NOT toISOString().slice(0,10),
// which converts through UTC and shifts the date back by a day for any user
// in a positive UTC offset (e.g. the Philippines, UTC+8) for a large part of
// the day. Confirmed by testing under Asia/Taipei (UTC+8): toISOString()
// made "the 1st of this month" resolve to the last day of the PREVIOUS
// month, always — not just near midnight.
function toLocalIso(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Defaults to "this calendar month so far" instead of a fixed date, so the
// page never again silently defaults to a stale month.
type RangePreset = "30d" | "month" | "all";

// The date range for a preset; "all" = no bounds. Defaults to the last 30
// days so recent scans (including the end of last month) are always shown —
// a "this month" default left the page empty on the 1st.
function presetRange(preset: RangePreset) {
  const now = new Date();
  if (preset === "all") return { from: "", to: "" };
  const start =
    preset === "month"
      ? new Date(now.getFullYear(), now.getMonth(), 1)
      : new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
  return { from: toLocalIso(start), to: toLocalIso(now) };
}

const PRESETS: { key: RangePreset; label: string }[] = [
  { key: "30d", label: "Last 30 days" },
  { key: "month", label: "This month" },
  { key: "all", label: "All dates" },
];

export default function TrashLogsPage() {
  const [from, setFrom] = useState(() => presetRange("30d").from);
  const [to, setTo] = useState(() => presetRange("30d").to);
  const query = useApi(() => api.trashLogs(), []);

  const applyPreset = (preset: RangePreset) => {
    const range = presetRange(preset);
    setFrom(range.from);
    setTo(range.to);
  };
  const activePreset = PRESETS.find((p) => {
    const range = presetRange(p.key);
    return range.from === from && range.to === to;
  })?.key;

  // Empty bound = unbounded on that side.
  const filtered = (query.data ?? []).filter((t) => (!from || t.date >= from) && (!to || t.date <= to));

  return (
    <div>
      <PageHeader
        eyebrow={`${filtered.length} entries`}
        title="Trash logs"
        description="QR scans recorded by staff during collection, including embedded violations."
        actions={<ExportButton filename="trash-logs" rows={filtered} />}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => applyPreset(p.key)}
            className={`stamp rounded-lg border px-3 py-1.5 text-[11px] font-medium transition-colors ${
              activePreset === p.key ? "border-pine bg-pine-tint text-pine-dark" : "border-line bg-paper text-ink/50 hover:text-ink"
            }`}
          >
            {p.label}
          </button>
        ))}
        <span className="ml-2 text-xs font-medium text-ink/50">Date range</span>
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="rounded-lg border border-line bg-paper px-2.5 py-1.5 text-xs text-ink"
        />
        <span className="text-ink/30">to</span>
        <input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="rounded-lg border border-line bg-paper px-2.5 py-1.5 text-xs text-ink"
        />
      </div>

      <AsyncSection query={query}>
        {() => (
          <DataTable
            data={filtered}
            columns={columns}
            searchPlaceholder="Search by household, code, or collector…"
            searchKeys={(t) => `${t.representative} ${t.householdCode} ${t.collector}`}
            pageSize={10}
          />
        )}
      </AsyncSection>
    </div>
  );
}
