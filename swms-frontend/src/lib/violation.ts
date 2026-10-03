// Local calendar date as YYYY-MM-DD — deliberately NOT toISOString().slice(0,10),
// which reads the UTC calendar date and can show a day behind for a user in
// the Philippines (UTC+8) completing something in the early morning.
// Mirrors the exact pattern already established in admin/trash-logs and
// purok-leader/scan. resolvedAt is a full timestamp (unlike the app's other
// @db.Date fields, which are already safe pre-formatted strings), so it's
// the one violation field that actually needs this conversion.
export function formatResolvedDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
