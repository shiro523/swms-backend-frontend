"use client";

import { Download } from "lucide-react";
import { exportToCsv } from "@/lib/exportCsv";

export function ExportButton<T extends object>({
  filename,
  rows,
  label = "Export to CSV",
}: {
  filename: string;
  rows: T[];
  label?: string;
}) {
  return (
    <button
      onClick={() => exportToCsv(filename, rows)}
      className="flex items-center gap-2 rounded-lg border border-line bg-paper px-3.5 py-2 text-[13px] font-medium text-ink/70 transition-colors hover:border-pine/40 hover:text-pine-dark"
    >
      <Download size={14} />
      {label}
    </button>
  );
}
