"use client";

import { ReactNode, useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  widthClassName = "max-w-md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  widthClassName?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  // Rendered into <body>, not where the component sits: a dialog opened from
  // a table cell (e.g. a row's Complete button) would otherwise inherit the
  // cell's no-wrap text and spill past the dialog's edges.
  return createPortal(
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto whitespace-normal p-4 sm:items-center">
      <div className="fixed inset-0 bg-ink/40 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative z-10 w-full ${widthClassName} rounded-2xl border border-line bg-paper shadow-xl`}>
        <div className="flex items-start justify-between border-b border-line px-5 py-4">
          <div>
            <p className="font-[family-name:var(--font-display)] text-base font-semibold text-ink">{title}</p>
            {description && <p className="mt-0.5 text-xs text-ink/55">{description}</p>}
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-ink/40 hover:bg-panel hover:text-ink" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

/** Shared field styles for dialog forms. */
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-ink/55">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

export const inputClass =
  "w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-pine";
