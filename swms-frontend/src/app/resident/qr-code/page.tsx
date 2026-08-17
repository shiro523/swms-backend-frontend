"use client";

import { PageHeader, Card } from "@/components/ui/Primitives";
import { AsyncSection } from "@/components/ui/AsyncSection";
import { QrSticker } from "./QrSticker";
import { useApi } from "@/hooks/useApi";
import { api } from "@/lib/api";

export default function ResidentQrCodePage() {
  const query = useApi(() => api.households().then((h) => h[0]), []);

  return (
    <AsyncSection query={query}>
      {(household) => {
        return (
          <div>
            <div className="no-print">
              <PageHeader
                eyebrow={household.code}
                title="My QR code"
                description="Attach the printed sticker to your trash bag. Staff scan it during collection."
              />
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,360px)_1fr]">
              {/* The sticker itself — this is what should print. */}
              <QrSticker household={household} />

              <Card className="no-print p-6">
                <p className="text-sm font-semibold text-ink">How the QR sticker is used</p>
                <ol className="mt-3 space-y-3 text-sm text-ink/65">
                  <li className="flex gap-3">
                    <span className="stamp flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-pine-tint text-[11px] text-pine-dark">1</span>
                    Print or screenshot your household&apos;s QR sticker and attach it to your trash bag before collection day.
                  </li>
                  <li className="flex gap-3">
                    <span className="stamp flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-pine-tint text-[11px] text-pine-dark">2</span>
                    Barangay staff scan the sticker on collection to record who disposed the bag and whether it was properly segregated.
                  </li>
                  <li className="flex gap-3">
                    <span className="stamp flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-pine-tint text-[11px] text-pine-dark">3</span>
                    Compliance, violations, and collection history are updated automatically on your dashboard.
                  </li>
                </ol>
                <div className="mt-5 rounded-xl bg-panel/60 p-4 text-xs text-ink/55">
                  Lost or damaged your sticker? Request a replacement from your purok leader or the barangay office — your QR code stays linked to your household ID.
                </div>
              </Card>
            </div>
          </div>
        );
      }}
    </AsyncSection>
  );
}
