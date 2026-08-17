import clsx from "clsx";

type Tone = "pine" | "clay" | "azure" | "gold" | "neutral";

const TONE_CLASSES: Record<Tone, string> = {
  pine: "bg-pine-tint text-pine-dark border-pine/30",
  clay: "bg-clay-tint text-clay border-clay/30",
  azure: "bg-azure-tint text-azure border-azure/30",
  gold: "bg-gold-tint text-gold border-gold/30",
  neutral: "bg-panel text-ink/60 border-line",
};

const STATUS_TONE: Record<string, Tone> = {
  compliant: "pine",
  paid: "pine",
  active: "pine",
  violation: "clay",
  unpaid: "clay",
  missed: "clay",
  pending: "gold",
  "walk-in": "azure",
  transferred: "azure",
};

export function StatusBadge({ status }: { status: string }) {
  const tone = STATUS_TONE[status] ?? "neutral";
  return (
    <span
      className={clsx(
        "stamp inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10.5px] font-medium",
        TONE_CLASSES[tone]
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status.replace(/-/g, " ")}
    </span>
  );
}
