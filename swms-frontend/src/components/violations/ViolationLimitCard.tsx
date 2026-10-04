"use client";

import { useState } from "react";
import { AlertTriangle, Loader2, Send } from "lucide-react";
import { Card } from "@/components/ui/Primitives";
import { Modal } from "@/components/ui/Modal";
import { api, ApiError, type HouseholdAtLimit, type ViolationsAtLimit } from "@/lib/api";

function defaultNotice(h: HouseholdAtLimit, threshold: number) {
  return (
    `Your household (${h.householdCode}) now has ${h.totalViolations} waste segregation violations on record — ` +
    `the barangay limit is ${threshold}. Further violations may lead to penalties under the barangay's waste ` +
    `management rules. Please coordinate with your purok leader to comply.`
  );
}

// Households that have reached the violation limit. The admin can send each
// one a consequence notice (editable before sending); purok leaders see the
// same list read-only, including whether a notice has gone out.
export function ViolationLimitCard({
  data,
  canNotify,
  onSent,
}: {
  data: ViolationsAtLimit;
  canNotify: boolean;
  onSent: () => void;
}) {
  const [target, setTarget] = useState<HouseholdAtLimit | null>(null);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const open = (h: HouseholdAtLimit) => {
    setTarget(h);
    setMessage(defaultNotice(h, data.threshold));
    setError(null);
  };

  const send = async () => {
    if (!target) return;
    setSending(true);
    setError(null);
    try {
      await api.sendConsequenceNotice(target.householdId, message.trim());
      setSentTo(`${target.representative} (${target.householdCode})`);
      setTarget(null);
      onSent();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not send the notice.");
    } finally {
      setSending(false);
    }
  };

  return (
    <Card className="mb-4 p-5">
      <div className="flex items-start gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-clay-tint text-clay">
          <AlertTriangle size={15} />
        </span>
        <div>
          <p className="text-sm font-semibold text-ink">
            Households at the {data.threshold}-violation limit
            {data.households.length > 0 && (
              <span className="ml-2 rounded-full bg-clay-tint px-2 py-0.5 text-[11px] font-medium text-clay">
                {data.households.length}
              </span>
            )}
          </p>
          <p className="text-xs text-ink/50">
            Every violation on record counts, including completed ones.{" "}
            {canNotify
              ? "Send each household a consequence notice."
              : "The admin sends the consequence notice; mark violations completed once the resident complies."}
          </p>
        </div>
      </div>

      {sentTo && (
        <p className="mt-3 rounded-lg border border-pine/20 bg-pine-tint px-3 py-2 text-xs text-pine-dark">
          Consequence notice sent to {sentTo}.
        </p>
      )}

      <div className="mt-3 divide-y divide-line">
        {data.households.length === 0 && (
          <p className="py-2 text-sm text-ink/40">No household has reached {data.threshold} violations.</p>
        )}
        {data.households.map((h) => (
          <div key={h.householdId} className="flex flex-wrap items-center justify-between gap-3 py-2.5 text-sm">
            <div>
              <p className="font-medium text-ink">
                {h.representative} <span className="stamp text-[10px] text-ink/40">{h.householdCode}</span>
              </p>
              <p className="text-xs text-ink/50">
                {h.purokName} · <span className="font-semibold text-clay">{h.totalViolations} violations</span> (
                {h.activeViolations} active) ·{" "}
                {h.lastNoticeDate
                  ? `Notice sent ${h.lastNoticeDate}${h.noticesSent > 1 ? ` (${h.noticesSent} total)` : ""}`
                  : "No notice sent yet"}
              </p>
            </div>
            {canNotify && (
              <button
                type="button"
                onClick={() => open(h)}
                className="flex items-center gap-1.5 rounded-lg border border-clay/30 bg-paper px-3 py-1.5 text-[12px] font-medium text-clay hover:bg-clay-tint"
              >
                <Send size={13} /> {h.lastNoticeDate ? "Send again" : "Send consequence notice"}
              </button>
            )}
          </div>
        ))}
      </div>

      <Modal
        open={target !== null}
        onClose={() => !sending && setTarget(null)}
        title="Send consequence notice"
        description={target ? `To ${target.representative} (${target.householdCode}) · ${target.totalViolations} violations on record` : ""}
        widthClassName="max-w-lg"
      >
        <div className="space-y-3">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={1000}
            rows={6}
            className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm leading-relaxed text-ink outline-none focus:border-pine"
          />
          <p className="text-xs text-ink/45">The resident receives this as a notification. You can edit the wording before sending.</p>
          {error && <p className="rounded-lg border border-clay/30 bg-clay-tint px-3 py-2 text-xs text-clay">{error}</p>}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setTarget(null)}
              disabled={sending}
              className="rounded-lg border border-line bg-paper px-3.5 py-2 text-[13px] font-medium text-ink/70 hover:border-pine/40"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={send}
              disabled={sending || message.trim().length === 0}
              className="flex items-center gap-2 rounded-lg bg-clay px-3.5 py-2 text-[13px] font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {sending ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Sending…
                </>
              ) : (
                <>
                  <Send size={14} /> Send notice
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>
    </Card>
  );
}
