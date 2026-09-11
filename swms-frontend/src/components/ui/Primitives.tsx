import { ReactNode } from "react";
import clsx from "clsx";
import { LucideIcon } from "lucide-react";

export function Card({
  children,
  className,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={clsx(
        "rounded-2xl border border-line bg-paper shadow-[0_1px_0_rgba(22,36,28,0.04)]",
        className
      )}
    >
      {children}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 border-b border-line pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="stamp text-[11px] font-medium text-pine">{eyebrow}</p>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-2xl font-semibold text-ink sm:text-[28px]">
          {title}
        </h1>
        {description && (
          <p className="mt-1.5 max-w-xl text-sm text-ink/60">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  tone = "pine",
}: {
  label: string;
  value: string;
  sub?: string;
  icon: LucideIcon;
  tone?: "pine" | "clay" | "azure" | "gold";
}) {
  const toneClasses: Record<string, string> = {
    pine: "bg-pine-tint text-pine-dark",
    clay: "bg-clay-tint text-clay",
    azure: "bg-azure-tint text-azure",
    gold: "bg-gold-tint text-gold",
  };
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-ink/50">
            {label}
          </p>
          <p className="mt-2 font-[family-name:var(--font-display)] text-[28px] font-semibold leading-none text-ink">
            {value}
          </p>
          {sub && <p className="mt-2 text-xs text-ink/50">{sub}</p>}
        </div>
        <span className={clsx("rounded-xl p-2.5", toneClasses[tone])}>
          <Icon className="h-4.5 w-4.5" strokeWidth={2} size={18} />
        </span>
      </div>
    </Card>
  );
}

export function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line py-16 text-center">
      <p className="font-[family-name:var(--font-display)] text-base font-semibold text-ink">
        {title}
      </p>
      <p className="mt-1 max-w-sm text-sm text-ink/50">{description}</p>
    </div>
  );
}
