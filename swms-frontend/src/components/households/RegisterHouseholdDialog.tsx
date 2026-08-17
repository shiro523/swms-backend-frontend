"use client";

import { useState } from "react";
import { UserPlus, Plus, Trash2, Loader2 } from "lucide-react";
import { Modal, Field, inputClass } from "@/components/ui/Modal";
import { api } from "@/lib/api";
import type { Household } from "@/lib/types";

interface MemberDraft {
  name: string;
  relation: string;
  age: string;
}

export function RegisterHouseholdDialog({
  onCreated,
  triggerLabel = "Register household",
}: {
  onCreated: (created: Household) => void;
  triggerLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [representative, setRepresentative] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [address, setAddress] = useState("");
  const [members, setMembers] = useState<MemberDraft[]>([]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");

  const reset = () => {
    setRepresentative("");
    setContactNumber("");
    setAddress("");
    setMembers([]);
    setUsername("");
    setPassword("");
    setEmail("");
    setError(null);
  };

  const close = () => {
    if (submitting) return;
    setOpen(false);
    reset();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const created = await api.createHousehold({
        representative,
        contactNumber,
        address,
        members: members
          .filter((m) => m.name.trim() && m.age.trim())
          .map((m) => ({ name: m.name.trim(), relation: m.relation.trim() || "Member", age: Number(m.age) })),
        username: username.trim(),
        password,
        email: email.trim(),
      });
      onCreated(created);
      setOpen(false);
      reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not register household.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-lg bg-pine px-3.5 py-2 text-[13px] font-medium text-white hover:bg-pine-dark"
      >
        <UserPlus size={14} />
        {triggerLabel}
      </button>

      <Modal open={open} onClose={close} title="Register household" description="Add a new household to the registry.">
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

          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-ink/55">Family members (optional)</span>
              <button
                type="button"
                onClick={() => setMembers((m) => [...m, { name: "", relation: "", age: "" }])}
                className="flex items-center gap-1 text-xs font-medium text-pine-dark hover:underline"
              >
                <Plus size={12} /> Add
              </button>
            </div>
            <div className="mt-2 space-y-2">
              {members.map((m, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input placeholder="Name" className={inputClass} value={m.name}
                    onChange={(e) => setMembers((arr) => arr.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                  <input placeholder="Relation" className={inputClass} value={m.relation}
                    onChange={(e) => setMembers((arr) => arr.map((x, j) => (j === i ? { ...x, relation: e.target.value } : x)))} />
                  <input placeholder="Age" type="number" min="0" className="w-20 rounded-lg border border-line bg-paper px-2 py-2 text-sm text-ink outline-none focus:border-pine" value={m.age}
                    onChange={(e) => setMembers((arr) => arr.map((x, j) => (j === i ? { ...x, age: e.target.value } : x)))} />
                  <button type="button" onClick={() => setMembers((arr) => arr.filter((_, j) => j !== i))} className="text-ink/40 hover:text-clay" aria-label="Remove">
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {error && <p className="rounded-lg border border-clay/30 bg-clay-tint px-3 py-2 text-xs text-clay">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={close} className="rounded-lg border border-line bg-paper px-3.5 py-2 text-[13px] font-medium text-ink/70 hover:border-pine/40">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="flex items-center gap-2 rounded-lg bg-pine px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-pine-dark disabled:opacity-50">
              {submitting ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : "Register"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
