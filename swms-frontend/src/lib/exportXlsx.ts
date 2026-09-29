export interface XlsxColumn<T> {
  header: string;
  accessor: (row: T) => string | number | null | undefined;
  numFmt?: string;
  width?: number;
}

// exceljs is loaded on demand (only when an .xlsx export is actually
// triggered) so pages that only ever use the plain CSV export (every Admin
// page, plus the Purok Leader Households page) never pull it into their
// bundle.
export async function exportToXlsx<T>(filename: string, rows: T[], columns: XlsxColumn<T>[]) {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Sheet1");

  sheet.columns = columns.map((c) => ({
    header: c.header,
    key: c.header,
    width: c.width ?? Math.max(12, c.header.length + 4),
  }));

  for (const row of rows) {
    const values: Record<string, string | number> = {};
    for (const c of columns) {
      // Empty/missing values become "" rather than the literal text
      // "undefined"/"null", and numbers are kept as real numbers (never
      // stringified) so currency columns stay genuinely numeric cells.
      const value = c.accessor(row);
      values[c.header] = value ?? "";
    }
    sheet.addRow(values);
  }

  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: "frozen", ySplit: 1 }];

  columns.forEach((c, i) => {
    if (c.numFmt) sheet.getColumn(i + 1).numFmt = c.numFmt;
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
