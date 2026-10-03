"use client";

import { useState } from "react";
import { UserMinus, Loader2 } from "lucide-react";
import { Modal, Field, inputClass } from "@/components/ui/Modal";
import { api } from "@/lib/api";
import type { Household } from "@/lib/types";

const PRESET_REASONS = [
  "Moved to another barangay",
  "Permanently left the barangay",
  "Other",
] as const;

export function RemoveHouseholdDialog({
  household,
  onRemoved,
}: {
  household: Household;
  onRemoved: (updated: Household) => void;
}) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preset, setPreset] = useState<(typeof PRESET_REASONS)[number]>(PRESET_REASONS[0]);
  const [note, setNote] = useState("");

  const openDialog = () => {
    setPreset(PRESET_REASONS[0]);
    setNote("");
    setError(null);
    setOpen(true);
  };

  const close = () => {
    if (submitting) return;
    setOpen(false);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const reason = preset === "Other" ? note.trim() : preset;
    if (!reason) {
      setError("Please describe the reason for removal.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const updated = await api.removeHousehold(household.id, reason);
      onRemoved(updated);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove household.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <button
        onClick={openDialog}
        className="flex items-center gap-2 rounded-lg border border-clay/30 bg-paper px-3.5 py-2 text-[13px] font-medium text-clay hover:bg-clay-tint"
      >
        <UserMinus size={14} />
        Remove household
      </button>

      <Modal
        open={open}
        onClose={close}
        title="Remove this household?"
        description="The household is marked inactive and hidden from your active list. No trash logs, violations, or payment history are deleted, and an admin can restore it later."
      >
        <form onSubmit={submit} className="space-y-3">
          <Field label="Reason for removal">
            <select
              className={inputClass}
              value={preset}
              onChange={(e) => setPreset(e.target.value as (typeof PRESET_REASONS)[number])}
            >
              {PRESET_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </Field>

          {preset === "Other" && (
            <Field label="Please specify">
              <input
                className={inputClass}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={300}
                required
                autoFocus
              />
            </Field>
          )}

          {error && <p className="rounded-lg border border-clay/30 bg-clay-tint px-3 py-2 text-xs text-clay">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={close} className="rounded-lg border border-line bg-paper px-3.5 py-2 text-[13px] font-medium text-ink/70 hover:border-pine/40">
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 rounded-lg bg-clay px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-clay/90 disabled:opacity-50"
            >
              {submitting ? <><Loader2 size={14} className="animate-spin" /> Removing…</> : "Remove household"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
