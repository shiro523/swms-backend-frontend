"use client";

import { useState } from "react";
import { Plus, Loader2 } from "lucide-react";
import { Modal, Field, inputClass } from "@/components/ui/Modal";
import { api } from "@/lib/api";
import type { Purok } from "@/lib/types";

export function AddPurokDialog({ onCreated }: { onCreated: (created: Purok) => void }) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [leaderName, setLeaderName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");

  const close = () => {
    if (submitting) return;
    setOpen(false);
    setName("");
    setLeaderName("");
    setUsername("");
    setPassword("");
    setEmail("");
    setError(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const created = await api.createPurok({
        name,
        leaderName,
        username: username.trim(),
        password,
        email: email.trim(),
      });
      onCreated(created);
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add purok.");
      setSubmitting(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-lg bg-pine px-3.5 py-2 text-[13px] font-medium text-white hover:bg-pine-dark"
      >
        <Plus size={14} />
        Add purok
      </button>

      <Modal open={open} onClose={close} title="Add purok" description="Create a new purok and assign its leader.">
        <form onSubmit={submit} className="space-y-3">
          <Field label="Purok name">
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Purok 6 - Del Pilar" required />
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
              <Field label="Password">
                <input type="password" className={inputClass} value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required />
              </Field>
              <div className="col-span-2">
                <Field label="Email">
                  <input type="email" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} required />
                </Field>
              </div>
            </div>
          </div>

          {error && <p className="rounded-lg border border-clay/30 bg-clay-tint px-3 py-2 text-xs text-clay">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={close} className="rounded-lg border border-line bg-paper px-3.5 py-2 text-[13px] font-medium text-ink/70 hover:border-pine/40">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="flex items-center gap-2 rounded-lg bg-pine px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-pine-dark disabled:opacity-50">
              {submitting ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : "Create purok"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
