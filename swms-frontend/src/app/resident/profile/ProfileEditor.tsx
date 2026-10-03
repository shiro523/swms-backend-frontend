"use client";

import { useState } from "react";
import { Loader2, Plus, Pencil, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/Primitives";
import { Modal, Field } from "@/components/ui/Modal";
import { api } from "@/lib/api";
import { ageInputProps, toAge } from "@/lib/numericInput";
import type { Household, FamilyMember } from "@/lib/types";

export function ProfileEditor({
  household,
  onChanged,
}: {
  household: Household;
  onChanged: () => void;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [mName, setMName] = useState("");
  const [mRelation, setMRelation] = useState("");
  const [mAge, setMAge] = useState("");
  const [addingMember, setAddingMember] = useState(false);
  const [memberErr, setMemberErr] = useState<string | null>(null);

  const [editingMember, setEditingMember] = useState<FamilyMember | null>(null);
  const [eName, setEName] = useState("");
  const [eRelation, setERelation] = useState("");
  const [eAge, setEAge] = useState("");
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [removingMember, setRemovingMember] = useState<FamilyMember | null>(null);
  const [removeSubmitting, setRemoveSubmitting] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const inputClass =
    "mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-pine";

  const addMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setMemberErr(null);
    setAddingMember(true);
    try {
      await api.addFamilyMember(household.id, {
        name: mName.trim(),
        relation: mRelation.trim() || "Member",
        age: Number(mAge),
      });
      setMName("");
      setMRelation("");
      setMAge("");
      setShowAdd(false);
      onChanged();
    } catch (err) {
      setMemberErr(err instanceof Error ? err.message : "Could not add member.");
    } finally {
      setAddingMember(false);
    }
  };

  const openEdit = (m: FamilyMember) => {
    setEditingMember(m);
    setEName(m.name);
    setERelation(m.relation);
    setEAge(String(m.age));
    setEditError(null);
  };

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember) return;
    setEditError(null);
    setEditSubmitting(true);
    try {
      await api.updateFamilyMember(household.id, editingMember.id, {
        name: eName.trim(),
        relation: eRelation.trim() || "Member",
        age: Number(eAge),
      });
      setEditingMember(null);
      onChanged();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Could not update family member.");
    } finally {
      setEditSubmitting(false);
    }
  };

  const confirmRemove = async () => {
    if (!removingMember) return;
    setRemoveError(null);
    setRemoveSubmitting(true);
    try {
      await api.removeFamilyMember(household.id, removingMember.id);
      setRemovingMember(null);
      onChanged();
    } catch (err) {
      setRemoveError(err instanceof Error ? err.message : "Could not remove family member.");
    } finally {
      setRemoveSubmitting(false);
    }
  };

  return (
    <div>
      <Card className="p-5">
        <p className="text-sm font-semibold text-ink">Family members</p>
        <div className="mt-3 divide-y divide-line">
          {household.members.map((m) => (
            <div key={m.id} className="flex items-center justify-between py-2.5 text-sm">
              <span className="text-ink/80">{m.name}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-ink/45">{m.relation} · {m.age} y/o</span>
                <button
                  type="button"
                  onClick={() => openEdit(m)}
                  aria-label={`Edit ${m.name}`}
                  className="rounded-lg p-1.5 text-ink/40 hover:bg-panel hover:text-ink"
                >
                  <Pencil size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => setRemovingMember(m)}
                  aria-label={`Remove ${m.name}`}
                  className="rounded-lg p-1.5 text-ink/40 hover:bg-clay-tint hover:text-clay"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
          {household.members.length === 0 && <p className="py-2.5 text-sm text-ink/40">No members recorded yet.</p>}
        </div>

        {showAdd ? (
          <form onSubmit={addMember} className="mt-4 space-y-2 rounded-xl border border-line bg-panel/40 p-3">
            <input placeholder="Name" value={mName} onChange={(e) => setMName(e.target.value)} required className={inputClass} />
            <div className="flex gap-2">
              <input placeholder="Relation" value={mRelation} onChange={(e) => setMRelation(e.target.value)} className={inputClass} />
              <input placeholder="Age" {...ageInputProps} value={mAge} onChange={(e) => setMAge(toAge(e.target.value))} required className={`${inputClass} w-24`} />
            </div>
            {memberErr && <p className="text-xs text-clay">{memberErr}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowAdd(false)} className="rounded-lg border border-line bg-paper px-3 py-1.5 text-xs font-medium text-ink/70">
                Cancel
              </button>
              <button type="submit" disabled={addingMember} className="flex items-center gap-1.5 rounded-lg bg-pine px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
                {addingMember ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Add
              </button>
            </div>
          </form>
        ) : (
          <button onClick={() => setShowAdd(true)} className="mt-4 flex items-center gap-1 text-xs font-medium text-pine-dark hover:underline">
            <Plus size={12} /> Add family member
          </button>
        )}
      </Card>

      <Modal
        open={!!editingMember}
        onClose={() => {
          if (editSubmitting) return;
          setEditingMember(null);
        }}
        title="Edit family member"
        description="Correct this family member's name or relationship."
      >
        <form onSubmit={saveEdit} className="space-y-3">
          <Field label="Name">
            <input className={inputClass} value={eName} onChange={(e) => setEName(e.target.value)} required />
          </Field>
          <div className="flex gap-2">
            <Field label="Relation">
              <input className={inputClass} value={eRelation} onChange={(e) => setERelation(e.target.value)} />
            </Field>
            <Field label="Age">
              <input {...ageInputProps} className={inputClass} value={eAge} onChange={(e) => setEAge(toAge(e.target.value))} required />
            </Field>
          </div>
          {editError && <p className="rounded-lg border border-clay/30 bg-clay-tint px-3 py-2 text-xs text-clay">{editError}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setEditingMember(null)}
              disabled={editSubmitting}
              className="rounded-lg border border-line bg-paper px-3.5 py-2 text-[13px] font-medium text-ink/70 hover:border-pine/40"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={editSubmitting}
              className="flex items-center gap-2 rounded-lg bg-pine px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-pine-dark disabled:opacity-50"
            >
              {editSubmitting ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : "Save changes"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!removingMember}
        onClose={() => {
          if (removeSubmitting) return;
          setRemovingMember(null);
        }}
        title="Remove family member?"
        description={removingMember ? `Are you sure you want to remove ${removingMember.name}?` : undefined}
      >
        <div className="space-y-3">
          {removeError && <p className="rounded-lg border border-clay/30 bg-clay-tint px-3 py-2 text-xs text-clay">{removeError}</p>}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setRemovingMember(null)}
              disabled={removeSubmitting}
              className="rounded-lg border border-line bg-paper px-3.5 py-2 text-[13px] font-medium text-ink/70 hover:border-pine/40"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmRemove}
              disabled={removeSubmitting}
              className="flex items-center gap-2 rounded-lg bg-clay px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-clay/90 disabled:opacity-50"
            >
              {removeSubmitting ? <><Loader2 size={14} className="animate-spin" /> Removing…</> : "Remove"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
