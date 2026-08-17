"use client";

import { useState } from "react";
import { Pencil, Loader2 } from "lucide-react";
import { Modal, Field, inputClass } from "@/components/ui/Modal";
import { api } from "@/lib/api";
import type { Purok } from "@/lib/types";

export function EditPurokDialog({
  purok,
  leaderUsername,
  leaderEmail,
  onUpdated,
}: {
  purok: Purok;
  leaderUsername: string;
  leaderEmail: string;
  onUpdated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(purok.name);
  const [leaderName, setLeaderName] = useState(purok.leader);
  const [username, setUsername] = useState(leaderUsername);
  const [email, setEmail] = useState(leaderEmail);

  const openDialog = () => {
    setName(purok.name);
    setLeaderName(purok.leader);
    setUsername(leaderUsername);
    setEmail(leaderEmail);
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
      await api.updatePurok(purok.id, {
        name: name.trim(),
        leaderName: leaderName.trim(),
        username: username.trim(),
        email: email.trim(),
      });
      onUpdated();
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update purok.");
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

      <Modal open={open} onClose={close} title="Edit purok" description="Fix a typo in this purok's details or leader account.">
        <form onSubmit={submit} className="space-y-3">
          <Field label="Purok name">
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required />
          </Field>
          <Field label="Leader name">
            <input className={inputClass} value={leaderName} onChange={(e) => setLeaderName(e.target.value)} required />
          </Field>

          <div>
            <span className="text-xs font-medium text-ink/55">Purok-leader login account</span>
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
