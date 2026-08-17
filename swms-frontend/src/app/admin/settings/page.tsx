"use client";

import { PageHeader, Card } from "@/components/ui/Primitives";

function Field({ label, defaultValue }: { label: string; defaultValue: string }) {
  return (
    <div>
      <label className="text-xs font-medium text-ink/50">{label}</label>
      <input
        defaultValue={defaultValue}
        className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink"
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
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card className="p-5">
          <p className="text-sm font-semibold text-ink">Barangay profile</p>
          <div className="mt-3 space-y-3">
            <Field label="Barangay name" defaultValue="Barangay San Isidro" />
            <Field label="City / Municipality" defaultValue="Mandaue City" />
            <Field label="Contact number" defaultValue="032 345 6789" />
          </div>
        </Card>

        <Card className="p-5">
          <p className="text-sm font-semibold text-ink">Collection settings</p>
          <div className="mt-3 space-y-3">
            <Field label="Monthly collection fee (₱)" defaultValue="75.00" />
            <Field label="Collection days" defaultValue="Monday, Thursday" />
            <Field label="Default collection time" defaultValue="6:00 AM" />
          </div>
        </Card>
      </div>

      <div className="mt-4 flex justify-end">
        <button className="rounded-lg bg-pine px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-pine-dark">
          Save changes
        </button>
      </div>
    </div>
  );
}
