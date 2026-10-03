import clsx from "clsx";
import type { ViolationStatus } from "@/lib/types";

// Deliberately NOT the shared StatusBadge — its "active" tone already means
// something else elsewhere (the QR-scan page), and always renders pine
// (green/positive). An unresolved violation needs the opposite signal, so
// this stays a small, violation-specific presentation instead of touching
// that shared component's global meaning.
const TONE_CLASSES: Record<ViolationStatus, string> = {
  active: "bg-clay-tint text-clay border-clay/30",
  completed: "bg-pine-tint text-pine-dark border-pine/30",
};

const LABEL: Record<ViolationStatus, string> = {
  active: "Active",
  completed: "Completed",
};

export function ViolationStatusBadge({ status }: { status: ViolationStatus }) {
  return (
    <span
      className={clsx(
        "stamp inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10.5px] font-medium",
        TONE_CLASSES[status],
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {LABEL[status]}
    </span>
  );
}
