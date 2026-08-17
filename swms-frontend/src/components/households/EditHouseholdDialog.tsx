"use client";

import { useState } from "react";
import { Pencil, Loader2 } from "lucide-react";
import { Modal, Field, inputClass } from "@/components/ui/Modal";
import { api } from "@/lib/api";
import type { Household } from "@/lib/types";

export function EditHouseholdDialog({
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
  const [contactNumber, setContactNumber] = useState(household.contactNumber);
  const [address, setAddress] = useState(household.address);
  const [username, setUsername] = useState(household.username ?? "");
  const [email, setEmail] = useState(household.email ?? "");

  const openDialog = () => {
    setRepresentative(household.representative);
    setContactNumber(household.contactNumber);
    setAddress(household.address);
    setUsername(household.username ?? "");
    setEmail(household.email ?? "");
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
        contactNumber: contactNumber.trim(),
        address: address.trim(),
        username: username.trim(),
        email: email.trim(),
      });
      onUpdated(updated);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update household.");
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

      <Modal open={open} onClose={close} title="Edit household" description="Fix a typo in this household's details or account.">
        <form onSubmit={submit} className="space-y-3">
          <Field label="Representative name">
            <input className={inputClass} value={representative} onChange={(e) => setRepresentative(e.target.value)} required />
          </Field>
          <Field label="Contact number">
            <input className={inputClass} value={contactNumber} onChange={(e) => setContactNumber(e.target.value)} required />
          </Field>
          <Field label="Address">
            <input className={inputClass} value={address} onChange={(e) => setAddress(e.target.value)} required />
          </Field>

          <div>
            <span className="text-xs font-medium text-ink/55">Resident login account</span>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <Field label="Username">
                <input className={inputClass} value={username} onChange={(e) => setUsername(e.target.value)} minLength={3} required />
              </Field>
              <Field label="Email">
                <input type="email" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} required />
              </Field>
            </div>
          </div>

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
