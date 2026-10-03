"use client";

import { useState } from "react";
import { Pencil, Loader2 } from "lucide-react";
import { Modal, Field, inputClass } from "@/components/ui/Modal";
import { api, ApiError } from "@/lib/api";
import type { Payment } from "@/lib/types";

// Admin-only, deliberately narrow: the only thing this dialog can submit is
// a corrected period string. There is no amount, household, or date field
// here at all — not hidden, not disabled, simply absent — because the
// backend endpoint this calls (PATCH /payments/:id/period) is incapable of
// touching anything else either.
export function CorrectPaymentPeriodDialog({
  payment,
  onCorrected,
}: {
  payment: Payment;
  onCorrected: (updated: Payment) => void;
}) {
  const [open, setOpen] = useState(false);
  const [period, setPeriod] = useState(payment.period);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openDialog = () => {
    setPeriod(payment.period);
    setError(null);
    setOpen(true);
  };

  const close = () => {
    if (submitting) return;
    setOpen(false);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const updated = await api.correctPaymentPeriod(payment.id, period.trim());
      onCorrected(updated);
      setOpen(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not correct this payment's period.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        aria-label="Correct period"
        className="rounded-lg p-1.5 text-ink/40 hover:bg-panel hover:text-ink"
        title="Correct period"
      >
        <Pencil size={13} />
      </button>

      <Modal
        open={open}
        onClose={close}
        title="Correct period"
        description={`Fix this payment's stored period (currently "${payment.period}"). Amount, household, and date paid cannot be changed here.`}
      >
        <form onSubmit={submit} className="space-y-3">
          <Field label="Period">
            <input
              className={inputClass}
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              placeholder="e.g. October 2026"
              required
            />
          </Field>

          {error && <p className="rounded-lg border border-clay/30 bg-clay-tint px-3 py-2 text-xs text-clay">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={close} className="rounded-lg border border-line bg-paper px-3.5 py-2 text-[13px] font-medium text-ink/70 hover:border-pine/40">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="flex items-center gap-2 rounded-lg bg-pine px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-pine-dark disabled:opacity-50">
              {submitting ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : "Correct period"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
