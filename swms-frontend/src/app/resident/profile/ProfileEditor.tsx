"use client";

import { useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { Card } from "@/components/ui/Primitives";
import { api } from "@/lib/api";
import type { Household } from "@/lib/types";

export function ProfileEditor({
  household,
  onChanged,
}: {
  household: Household;
  onChanged: () => void;
}) {
  const [representative, setRepresentative] = useState(household.representative);
  const [contactNumber, setContactNumber] = useState(household.contactNumber);
  const [address, setAddress] = useState(household.address);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [showAdd, setShowAdd] = useState(false);
  const [mName, setMName] = useState("");
  const [mRelation, setMRelation] = useState("");
  const [mAge, setMAge] = useState("");
  const [addingMember, setAddingMember] = useState(false);
  const [memberErr, setMemberErr] = useState<string | null>(null);

  const inputClass =
    "mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-pine";

  const saveProfile = async () => {
    setSavingProfile(true);
    setProfileMsg(null);
    try {
      await api.updateHousehold(household.id, { representative, contactNumber, address });
      setProfileMsg({ ok: true, text: "Saved." });
      onChanged();
    } catch (err) {
      setProfileMsg({ ok: false, text: err instanceof Error ? err.message : "Save failed." });
    } finally {
      setSavingProfile(false);
    }
  };

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

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <Card className="p-5">
        <p className="text-sm font-semibold text-ink">House representative</p>
        <div className="mt-3 space-y-3">
          <label className="block">
            <span className="text-xs font-medium text-ink/50">Full name</span>
            <input value={representative} onChange={(e) => setRepresentative(e.target.value)} className={inputClass} />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-ink/50">Contact number</span>
            <input value={contactNumber} onChange={(e) => setContactNumber(e.target.value)} className={inputClass} />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-ink/50">Address</span>
            <input value={address} onChange={(e) => setAddress(e.target.value)} className={inputClass} />
          </label>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={saveProfile}
            disabled={savingProfile}
            className="flex items-center gap-2 rounded-lg bg-pine px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-pine-dark disabled:opacity-50"
          >
            {savingProfile ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : "Save changes"}
          </button>
          {profileMsg && (
            <span className={`text-xs ${profileMsg.ok ? "text-pine-dark" : "text-clay"}`}>{profileMsg.text}</span>
          )}
        </div>
      </Card>

      <Card className="p-5">
        <p className="text-sm font-semibold text-ink">Family members</p>
        <div className="mt-3 divide-y divide-line">
          {household.members.map((m) => (
            <div key={m.id} className="flex items-center justify-between py-2.5 text-sm">
              <span className="text-ink/80">{m.name}</span>
              <span className="text-xs text-ink/45">{m.relation} · {m.age} y/o</span>
            </div>
          ))}
          {household.members.length === 0 && <p className="py-2.5 text-sm text-ink/40">No members recorded yet.</p>}
        </div>

        {showAdd ? (
          <form onSubmit={addMember} className="mt-4 space-y-2 rounded-xl border border-line bg-panel/40 p-3">
            <input placeholder="Name" value={mName} onChange={(e) => setMName(e.target.value)} required className={inputClass} />
            <div className="flex gap-2">
              <input placeholder="Relation" value={mRelation} onChange={(e) => setMRelation(e.target.value)} className={inputClass} />
              <input placeholder="Age" type="number" min="0" value={mAge} onChange={(e) => setMAge(e.target.value)} required className={`${inputClass} w-24`} />
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
    </div>
  );
}
