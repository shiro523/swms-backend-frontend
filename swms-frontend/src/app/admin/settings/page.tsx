"use client";

import { Lock } from "lucide-react";
import { PageHeader, Card } from "@/components/ui/Primitives";
import { StatusBadge } from "@/components/ui/StatusBadge";

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <label className="text-xs font-medium text-ink/50">{label}</label>
      <input
        value={value}
        disabled
        readOnly
        className="mt-1 w-full cursor-not-allowed rounded-lg border border-line bg-panel/60 px-3 py-2 text-sm text-ink/60"
      />
    </div>
  );
}

export default function SettingsPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Configuration"
        title="Settings"
        description="Barangay profile, collection fee, and role assignments."
        actions={<StatusBadge status="pending" />}
      />

      <div className="mb-4 flex items-start gap-2.5 rounded-2xl border border-dashed border-line bg-panel/40 p-4 text-sm text-ink/60">
        <Lock size={15} className="mt-0.5 shrink-0 text-ink/40" />
        <p>
          These settings are not yet configurable in this version of the system. Values below are shown for
          reference only.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card className="p-5">
          <p className="text-sm font-semibold text-ink">Barangay profile</p>
          <div className="mt-3 space-y-3">
            <Field label="Barangay name" value="Barangay San Isidro" />
            <Field label="City / Municipality" value="Mandaue City" />
            <Field label="Contact number" value="032 345 6789" />
          </div>
        </Card>

        <Card className="p-5">
          <p className="text-sm font-semibold text-ink">Collection settings</p>
          <div className="mt-3 space-y-3">
            <Field label="Monthly collection fee (₱)" value="75.00" />
            <Field label="Collection days" value="Monday, Thursday" />
            <Field label="Default collection time" value="6:00 AM" />
          </div>
        </Card>
      </div>

      <div className="mt-4 flex justify-end">
        <button
          disabled
          className="cursor-not-allowed rounded-lg bg-panel px-4 py-2.5 text-[13px] font-semibold text-ink/40"
        >
          Settings unavailable
        </button>
      </div>
    </div>
  );
}
