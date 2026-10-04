"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { exportToCsv } from "@/lib/exportCsv";
import { exportToXlsx, type XlsxColumn } from "@/lib/exportXlsx";

export function ExportButton<T extends object>({
  filename,
  rows,
  label,
  format = "csv",
  columns,
  disabled = false,
  disabledReason,
}: {
  // e.g. no records for the current filter — shown as the button tooltip.
  disabled?: boolean;
  disabledReason?: string;

  filename: string;
  rows: T[];
  label?: string;
  format?: "csv" | "xlsx";
  // Required when format="xlsx" — CSV keeps inferring headers from object
  // keys exactly as before.
  columns?: XlsxColumn<T>[];
}) {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    if (disabled) return;
    if (format === "csv") {
      exportToCsv(filename, rows);
      return;
    }
    setError(null);
    setGenerating(true);
    try {
      if (!columns || columns.length === 0) {
        throw new Error("Missing column configuration for this export.");
      }
      await exportToXlsx(filename, rows, columns);
    } catch {
      setError("Could not generate the export. Please try again.");
    } finally {
      setGenerating(false);
    }
  };

  const button = (
    <button
      onClick={handleClick}
      disabled={generating || disabled}
      title={disabled ? disabledReason : undefined}
      className="flex items-center gap-2 rounded-lg border border-line bg-paper px-3.5 py-2 text-[13px] font-medium text-ink/70 transition-colors hover:border-pine/40 hover:text-pine-dark disabled:cursor-not-allowed disabled:opacity-60"
    >
      {generating ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
      {generating ? "Preparing…" : label ?? (format === "xlsx" ? "Export to Excel" : "Export to CSV")}
    </button>
  );

  // The CSV path renders exactly the bare button it always has — no wrapper,
  // no possible error line — since it's synchronous and has no failure mode
  // of its own. Only the async XLSX path can ever show an error, so only it
  // gets the extra wrapper.
  if (format === "csv") return button;

  return (
    <div className="flex flex-col items-end gap-1.5">
      {button}
      {error && <p className="text-[11px] text-clay">{error}</p>}
    </div>
  );
}
