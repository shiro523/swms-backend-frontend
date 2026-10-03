"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { PageHeader, Card } from "@/components/ui/Primitives";
import { AsyncSection } from "@/components/ui/AsyncSection";
import { useApi } from "@/hooks/useApi";
import { api, ApiError } from "@/lib/api";
import type { SystemSettings } from "@/lib/types";

const inputClass =
  "mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-pine";

function SettingsForm({ settings, onSaved }: { settings: SystemSettings; onSaved: () => void }) {
  const [barangayName, setBarangayName] = useState(settings.barangayName);
  const [municipality, setMunicipality] = useState(settings.municipality);
  const [contactNumber, setContactNumber] = useState(settings.contactNumber);
  const [monthlyCollectionFee, setMonthlyCollectionFee] = useState(String(settings.monthlyCollectionFee));
  const [collectionDays, setCollectionDays] = useState(settings.collectionDays);
  const [collectionTime, setCollectionTime] = useState(settings.collectionTime);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await api.updateSettings({
        barangayName: barangayName.trim(),
        municipality: municipality.trim(),
        contactNumber: contactNumber.trim(),
        monthlyCollectionFee: Number(monthlyCollectionFee),
        collectionDays: collectionDays.trim(),
        collectionTime: collectionTime.trim(),
      });
      onSaved();
      setMessage({ ok: true, text: "Settings saved." });
    } catch (err) {
      // Entered values are left exactly as typed — nothing is reset on failure.
      setMessage({ ok: false, text: err instanceof ApiError ? err.message : "Could not save settings." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <Card className="p-5">
        <p className="text-sm font-semibold text-ink">Barangay profile</p>
        <div className="mt-3 space-y-3">
          <label className="block">
            <span className="text-xs font-medium text-ink/50">Barangay name</span>
            <input className={inputClass} value={barangayName} onChange={(e) => setBarangayName(e.target.value)} maxLength={120} />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-ink/50">City / Municipality</span>
            <input className={inputClass} value={municipality} onChange={(e) => setMunicipality(e.target.value)} maxLength={120} />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-ink/50">Contact number</span>
            <input className={inputClass} value={contactNumber} onChange={(e) => setContactNumber(e.target.value)} maxLength={40} />
          </label>
        </div>
      </Card>

      <Card className="p-5">
        <p className="text-sm font-semibold text-ink">Collection settings</p>
        <div className="mt-3 space-y-3">
          <label className="block">
            <span className="text-xs font-medium text-ink/50">Monthly collection fee (₱)</span>
            <input
              type="number"
              step="0.01"
              min="0"
              className={inputClass}
              value={monthlyCollectionFee}
              onChange={(e) => setMonthlyCollectionFee(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-ink/50">Collection days</span>
            <input
              className={inputClass}
              value={collectionDays}
              onChange={(e) => setCollectionDays(e.target.value)}
              placeholder="e.g. Monday, Thursday"
              maxLength={120}
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-ink/50">Default collection time</span>
            <input
              className={inputClass}
              value={collectionTime}
              onChange={(e) => setCollectionTime(e.target.value)}
              placeholder="e.g. 6:00 AM"
              maxLength={60}
            />
          </label>
        </div>
      </Card>

      <div className="xl:col-span-2 flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-2 rounded-lg bg-pine px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-pine-dark disabled:opacity-50"
        >
          {saving ? (
            <>
              <Loader2 size={14} className="animate-spin" /> Saving…
            </>
          ) : (
            "Save changes"
          )}
        </button>
        {message && <span className={`text-xs ${message.ok ? "text-pine-dark" : "text-clay"}`}>{message.text}</span>}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const query = useApi(() => api.settings(), []);

  return (
    <div>
      <PageHeader
        eyebrow="Configuration"
        title="Settings"
        description="Barangay profile and collection configuration."
      />

      <AsyncSection query={query}>
        {(settings) => <SettingsForm settings={settings} onSaved={() => query.reload()} />}
      </AsyncSection>
    </div>
  );
}
