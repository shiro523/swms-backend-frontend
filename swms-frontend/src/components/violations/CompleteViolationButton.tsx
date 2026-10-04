"use client";

import { useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { api, ApiError } from "@/lib/api";
import type { Violation } from "@/lib/types";

// Shared by Admin and Purok Leader — same endpoint, same confirmation copy.
// The backend remains the sole authority on whether this specific violation
// is actually in the caller's scope; this button never assumes access on its
// own, it just surfaces whatever the API returns (a 404 here means out of
// scope or archived-purok, same as everywhere else in this app).
export function CompleteViolationButton({ violation, onCompleted }: { violation: Violation; onCompleted: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await api.completeViolation(violation.id);
      setConfirming(false);
      onCompleted();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not complete this violation.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError(null);
          setConfirming(true);
        }}
        className="flex items-center gap-1.5 rounded-lg border border-line bg-paper px-2.5 py-1.5 text-[12px] font-medium text-ink/70 hover:border-pine/40 hover:text-pine-dark"
      >
        <CheckCircle2 size={13} /> Complete
      </button>

      <Modal
        open={confirming}
        onClose={() => {
          if (submitting) return;
          setConfirming(false);
        }}
        title="Mark this violation as completed?"
        description="The user complied and settled his/her violation."
      >
        <div className="space-y-3">
          <div className="rounded-xl border border-line bg-panel/50 px-4 py-3 text-sm text-ink/70">
            <p className="font-medium text-ink">
              {violation.representative} <span className="stamp text-[10px] text-ink/40">{violation.householdCode}</span>
            </p>
            <p className="mt-0.5">
              {violation.type} · {violation.date}
            </p>
          </div>
          <p className="text-xs leading-relaxed text-ink/50">
            This closes the violation and can&apos;t be undone. It stays in the household&apos;s history and still counts
            toward the 5-violation limit.
          </p>
          {error && <p className="rounded-lg border border-clay/30 bg-clay-tint px-3 py-2 text-xs text-clay">{error}</p>}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={submitting}
              className="rounded-lg border border-line bg-paper px-3.5 py-2 text-[13px] font-medium text-ink/70 hover:border-pine/40"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={submitting}
              className="flex items-center gap-2 rounded-lg bg-pine px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-pine-dark disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Completing…
                </>
              ) : (
                "Confirm"
              )}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
