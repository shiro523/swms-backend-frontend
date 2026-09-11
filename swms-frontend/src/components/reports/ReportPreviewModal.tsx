"use client";

import { Modal } from "@/components/ui/Modal";

function humanizeKey(key: string) {
  const spaced = key.replace(/([A-Z])/g, " $1");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function ReportPreviewModal({
  open,
  onClose,
  title,
  rows,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  rows: object[];
}) {
  const records = rows as Record<string, unknown>[];
  const allKeys = records.length > 0 ? Object.keys(records[0]) : [];
  // Raw internal ids (id, householdId, ...) aren't useful to eyeball and their
  // long UUIDs push the actually meaningful columns off-screen — a human-
  // readable code/name field already identifies the row. The full export
  // still includes every field; this only trims what's shown here.
  const idLike = (key: string) => key === "id" || /Id$/.test(key);
  const headers = allKeys.filter((h) => !idLike(h));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={`${records.length} record${records.length === 1 ? "" : "s"}`}
      widthClassName="max-w-3xl"
    >
      {records.length === 0 ? (
        <p className="py-8 text-center text-sm text-ink/40">No records yet.</p>
      ) : (
        <div className="max-h-[60vh] overflow-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="stamp text-[10.5px] text-ink/40">
                {headers.map((h) => (
                  <th key={h} className="whitespace-nowrap px-2 py-2 font-medium">
                    {humanizeKey(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {records.map((row, i) => (
                <tr key={i} className="ledger-row">
                  {headers.map((h) => (
                    <td key={h} className="whitespace-nowrap px-2 py-2.5 text-ink/80">
                      {String(row[h] ?? "—")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}
