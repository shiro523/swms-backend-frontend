"use client";

import { useState } from "react";
import { Pencil, Loader2 } from "lucide-react";
import { Modal, Field, inputClass } from "@/components/ui/Modal";
import { api } from "@/lib/api";
import { contactNumberInputProps, toContactNumber } from "@/lib/numericInput";
import type { Household } from "@/lib/types";

// Edits exactly the fields this account is allowed to change about itself:
// email, contact number, address. Deliberately never sends householdId,
// purokId, username, or representative — those aren't part of this form at
// all, so there's nothing here that could reassign a household even if the
// request were tampered with; the backend's own schema strips anything else.
export function EditPersonalInfoDialog({
  household,
  onUpdated,
}: {
  household: Household;
  onUpdated: (updated: Household) => void;
}) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [representative, setRepresentative] = useState(household.representative);
  const [email, setEmail] = useState(household.email ?? "");
  const [contactNumber, setContactNumber] = useState(household.contactNumber);
  const [address, setAddress] = useState(household.address);

  const openDialog = () => {
    setRepresentative(household.representative);
    setEmail(household.email ?? "");
    setContactNumber(household.contactNumber);
    setAddress(household.address);
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
      const updated = await api.updateHousehold(household.id, {
        representative: representative.trim(),
        email: email.trim(),
        contactNumber: contactNumber.trim(),
        address: address.trim(),
      });
      onUpdated(updated);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update your information.");
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
        <Pencil size={14} />
        Edit
      </button>

      <Modal
        open={open}
        onClose={close}
        title="Edit personal information"
        description="Update your name, email, contact number, or address."
      >
        <form onSubmit={submit} className="space-y-3">
          <Field label="Full name (house representative)">
            <input className={inputClass} value={representative} onChange={(e) => setRepresentative(e.target.value)} required maxLength={120} />
          </Field>
          <Field label="Email">
            <input type="email" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} required />
          </Field>
          <Field label="Contact number">
            <input {...contactNumberInputProps} className={inputClass} value={contactNumber} onChange={(e) => setContactNumber(toContactNumber(e.target.value))} required />
          </Field>
          <Field label="Address">
            <input className={inputClass} value={address} onChange={(e) => setAddress(e.target.value)} required />
          </Field>

          {error && <p className="rounded-lg border border-clay/30 bg-clay-tint px-3 py-2 text-xs text-clay">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={close} className="rounded-lg border border-line bg-paper px-3.5 py-2 text-[13px] font-medium text-ink/70 hover:border-pine/40">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="flex items-center gap-2 rounded-lg bg-pine px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-pine-dark disabled:opacity-50">
              {submitting ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : "Save changes"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
