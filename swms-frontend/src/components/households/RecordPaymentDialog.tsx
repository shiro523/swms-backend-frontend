"use client";

import { useState } from "react";
import { Wallet, Loader2 } from "lucide-react";
import { Modal, Field, inputClass } from "@/components/ui/Modal";
import { api } from "@/lib/api";
import type { Payment } from "@/lib/types";

export function RecordPaymentDialog({
  householdId,
  onRecorded,
}: {
  householdId: string;
  onRecorded: (payment: Payment) => void;
}) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [period, setPeriod] = useState("");
  const [amount, setAmount] = useState("");
  const [orNumber, setOrNumber] = useState("");
  const [datePaid, setDatePaid] = useState("");

  const openDialog = () => {
    setPeriod("");
    setAmount("");
    setOrNumber("");
    setDatePaid("");
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
      const payment = await api.createPayment({
        householdId,
        period: period.trim(),
        amount: Number(amount),
        orNumber: orNumber.trim() || undefined,
        datePaid: datePaid || undefined,
      });
      onRecorded(payment);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not record payment.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <button
        onClick={openDialog}
        className="flex items-center gap-2 rounded-lg border border-line bg-paper px-3.5 py-2 text-[13px] font-medium text-ink/70 hover:border-pine/40"
      >
        <Wallet size={14} />
        Record payment
      </button>

      <Modal
        open={open}
        onClose={close}
        title="Record payment"
        description="Log a monthly collection fee payment for this household."
      >
        <form onSubmit={submit} className="space-y-3">
          <Field label="Period">
            <input
              className={inputClass}
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              placeholder="e.g. March 2026"
              required
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Amount (₱)">
              <input
                type="number"
                step="0.01"
                min="0.01"
                className={inputClass}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </Field>
            <Field label="OR number (optional)">
              <input className={inputClass} value={orNumber} onChange={(e) => setOrNumber(e.target.value)} />
            </Field>
          </div>
          <Field label="Date paid (optional — defaults to today)">
            <input type="date" className={inputClass} value={datePaid} onChange={(e) => setDatePaid(e.target.value)} />
          </Field>

          {error && <p className="rounded-lg border border-clay/30 bg-clay-tint px-3 py-2 text-xs text-clay">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={close}
              className="rounded-lg border border-line bg-paper px-3.5 py-2 text-[13px] font-medium text-ink/70 hover:border-pine/40"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 rounded-lg bg-pine px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-pine-dark disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Recording…
                </>
              ) : (
                "Record payment"
              )}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
