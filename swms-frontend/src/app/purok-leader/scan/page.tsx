"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Camera, CheckCircle2, ScanLine, TriangleAlert, RotateCcw, AlertCircle, Loader2 } from "lucide-react";
import Link from "next/link";
import { Card, PageHeader } from "@/components/ui/Primitives";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { api, ApiError } from "@/lib/api";
import { Household, TrashLog } from "@/lib/types";

function normalizeCode(value: string) {
  return value.trim().toUpperCase();
}

// Local calendar date as YYYY-MM-DD — not toISOString().slice(0,10), which
// converts through UTC and can shift the date back by a day for users in a
// positive UTC offset (e.g. the Philippines, UTC+8). Same fix already
// applied to admin/trash-logs/page.tsx's toLocalIso().
function todayIso() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function PurokLeaderScanPage() {
  const [scannerState, setScannerState] = useState<"requesting" | "scanning" | "success" | "error">("requesting");
  const [statusMessage, setStatusMessage] = useState("Requesting camera access…");
  const [selectedHousehold, setSelectedHousehold] = useState<Household | null>(null);
  const [duplicateMessage, setDuplicateMessage] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [action, setAction] = useState<"collected" | "violation" | "note">("collected");
  // No default — the leader must explicitly pick who disposed of the trash
  // rather than silently falling back to the backend's "representative"
  // default, which could record an incorrect person for every scan.
  const [disposedBy, setDisposedBy] = useState<"owner" | "representative" | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [purokName, setPurokName] = useState("");
  const [logs, setLogs] = useState<TrashLog[]>([]);
  const householdsRef = useRef<Household[]>([]);
  const logsRef = useRef<TrashLog[]>([]);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isMountedRef = useRef(true);

  // Load the leader's households (for QR matching) and existing logs (for the
  // duplicate-today hint). The backend re-checks scope and duplicates on save.
  useEffect(() => {
    let cancelled = false;
    Promise.all([api.puroks(), api.households(), api.trashLogs()])
      .then(([puroks, households, trashLogs]) => {
        if (cancelled) return;
        setPurokName(puroks[0]?.name ?? "");
        householdsRef.current = households;
        logsRef.current = trashLogs;
        setLogs(trashLogs);
      })
      .catch(() => {
        // Non-fatal: matching just won't find anything until this loads.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleDecoded = useCallback(async (html5QrCode: Html5Qrcode, decodedText: string) => {
    const normalizedCode = normalizeCode(decodedText);
    const matchedHousehold = householdsRef.current.find(
      (household) => normalizeCode(household.code) === normalizedCode,
    );

    if (!matchedHousehold) {
      setScannerState("error");
      setStatusMessage("Household not found. Scan again with a valid household QR code.");
      setCameraError(null);
      return;
    }

    const today = todayIso();
    const existingLog = logsRef.current.find(
      (log) => log.householdId === matchedHousehold.id && log.date === today,
    );
    const alreadyCollected = Boolean(existingLog);
    const message = alreadyCollected
      ? `Already collected today at ${existingLog?.time ?? "recently"}.`
      : `Matched ${matchedHousehold.code}.`;

    setSelectedHousehold(matchedHousehold);
    setScannerState(alreadyCollected ? "error" : "success");
    setStatusMessage(message);
    setDuplicateMessage(alreadyCollected ? message : null);
    setCameraError(null);

    if (html5QrCode.isScanning) {
      await html5QrCode.stop().catch(() => undefined);
    }
  }, []);

  const startScanning = useCallback(async (html5QrCode: Html5Qrcode, isCancelled: () => boolean) => {
    await html5QrCode.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 240, height: 240 } },
      (decodedText) => {
        if (isCancelled()) return;
        void handleDecoded(html5QrCode, decodedText);
      },
      () => undefined,
    );
  }, [handleDecoded]);

  useEffect(() => {
    isMountedRef.current = true;
    const html5QrCode = new Html5Qrcode("qr-reader");
    scannerRef.current = html5QrCode;

    async function stopIfScanning() {
      if (html5QrCode.isScanning) {
        await html5QrCode.stop().catch(() => undefined);
      }
    }

    async function initScanner() {
      if (!containerRef.current) return;

      try {
        await startScanning(html5QrCode, () => !isMountedRef.current);

        // Effect cleanup can fire (e.g. React Strict Mode's mount/unmount/remount in dev)
        // while start() is still resolving; stop immediately instead of leaving an orphaned stream.
        if (!isMountedRef.current) {
          await stopIfScanning();
          return;
        }

        setScannerState("scanning");
        setStatusMessage("Camera is live. Point it at a household QR sticker.");
        setCameraError(null);
      } catch (error) {
        if (isMountedRef.current) {
          const fallbackMessage = error instanceof Error ? error.message : "Unable to access the camera.";
          setScannerState("error");
          setStatusMessage("Camera permission denied or unavailable.");
          setCameraError(fallbackMessage);
        }
      }
    }

    void initScanner();

    return () => {
      isMountedRef.current = false;
      void stopIfScanning().then(() => {
        try {
          html5QrCode.clear();
        } catch {
          // ignore — element may already be detached during unmount
        }
      });
    };
  }, [startScanning]);

  async function handleRescan() {
    setSelectedHousehold(null);
    setDuplicateMessage(null);
    setCameraError(null);
    setNote("");
    setAction("collected");
    setDisposedBy(null);

    const html5QrCode = scannerRef.current;
    if (!html5QrCode) return;

    try {
      if (!html5QrCode.isScanning) {
        await startScanning(html5QrCode, () => !isMountedRef.current);
      }

      // The component may have unmounted while start() was still resolving above —
      // stop the stream we just opened instead of leaving it running in the background.
      if (!isMountedRef.current) {
        if (html5QrCode.isScanning) {
          await html5QrCode.stop().catch(() => undefined);
        }
        return;
      }

      setScannerState("scanning");
      setStatusMessage("Camera is live. Point it at a household QR sticker.");
    } catch (error) {
      if (!isMountedRef.current) return;
      const fallbackMessage = error instanceof Error ? error.message : "Unable to access the camera.";
      setScannerState("error");
      setStatusMessage("Camera permission denied or unavailable.");
      setCameraError(fallbackMessage);
    }
  }

  async function handleAction() {
    if (!selectedHousehold) return;
    // Guards against double-tap/rapid re-click firing two overlapping
    // requests for the same household — the actual duplicate-prevention
    // guarantee still has to come from the backend (see H-5), this only
    // stops the most common way a user accidentally triggers it.
    if (submitting) return;

    // A field note isn't a collection outcome — logging one would inflate the
    // household's compliance record, so we don't persist it.
    if (action === "note") {
      setScannerState("success");
      setStatusMessage(`Saved note for ${selectedHousehold.code}.`);
      setDuplicateMessage(null);
      setNote("");
      return;
    }

    // Require an explicit disposer choice — never silently fall through to
    // the backend's default. The "Save action" button is already disabled
    // in this state; this is a defensive backstop.
    if (!disposedBy) return;

    setSubmitting(true);
    try {
      const created = await api.createTrashLog({
        householdId: selectedHousehold.id,
        status: action === "violation" ? "violation" : "compliant",
        disposedBy,
        notes: note || undefined,
      });

      const next = [created, ...logsRef.current];
      logsRef.current = next;
      setLogs(next);

      setScannerState("success");
      setStatusMessage(`Logged ${action === "violation" ? "violation" : "collection"} for ${selectedHousehold.code}.`);
      setDuplicateMessage(null);
      setNote("");
      setDisposedBy(null);
    } catch (err) {
      setScannerState("error");
      if (err instanceof ApiError && err.status === 409) {
        setDuplicateMessage(err.message);
        setStatusMessage(err.message);
      } else {
        setStatusMessage(err instanceof Error ? err.message : "Failed to save action.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  const lastCollectionLog = selectedHousehold
    ? logs
        .filter((log) => log.householdId === selectedHousehold.id)
        .reduce<TrashLog | null>((latest, log) => (!latest || log.date > latest.date ? log : latest), null)
    : null;

  return (
    <div>
      <PageHeader
        eyebrow={purokName || "Your purok"}
        title="Scan QR"
        description="Use the camera to scan a household or bin QR sticker and record a field action."
        actions={
          <Link
            href="/purok-leader"
            className="inline-flex items-center gap-2 rounded-full border border-line bg-paper px-3.5 py-2 text-sm font-medium text-ink/70 hover:border-pine/40"
          >
            <RotateCcw size={15} /> Back to dashboard
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-ink">Live camera</p>
              <p className="text-xs text-ink/50">Mobile-first viewfinder for field use</p>
            </div>
            <StatusBadge status={scannerState === "scanning" ? "active" : scannerState === "success" ? "compliant" : "pending"} />
          </div>

          <div className="relative min-h-[340px] bg-[#0d1f18]">
            <div id="qr-reader" ref={containerRef} className="min-h-[340px] w-full" />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="h-48 w-48 rounded-[2rem] border-[3px] border-white/80 shadow-[0_0_0_9999px_rgba(13,31,24,0.55)]" />
            </div>
          </div>

          <div className="border-t border-line bg-paper/80 px-4 py-4 text-sm text-ink/70">
            {scannerState === "scanning" && (
              <div className="flex items-start gap-2">
                <ScanLine size={16} className="mt-0.5 shrink-0 text-pine" />
                <span>{statusMessage}</span>
              </div>
            )}
            {scannerState === "success" && (
              <div className="flex items-start gap-2">
                <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-pine" />
                <span>{statusMessage}</span>
              </div>
            )}
            {scannerState === "error" && (
              <div className="flex items-start gap-2">
                <TriangleAlert size={16} className="mt-0.5 shrink-0 text-clay" />
                <span>{statusMessage}</span>
              </div>
            )}
            {cameraError && <p className="mt-2 text-xs text-clay">{cameraError}</p>}
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-ink">
            <Camera size={16} className="text-pine" />
            Scan result
          </div>

          {!selectedHousehold ? (
            <div className="mt-4 rounded-2xl border border-dashed border-line bg-paper/50 p-6 text-center text-sm text-ink/55">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-panel">
                <AlertCircle size={18} className="text-ink/40" />
              </div>
              <p className="mt-3 font-medium text-ink">Awaiting scan</p>
              <p className="mt-1">The household details will appear here after a valid QR is scanned.</p>
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              <div className="rounded-2xl border border-pine/20 bg-pine-tint p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-pine">Matched household</p>
                <p className="mt-2 font-[family-name:var(--font-display)] text-xl font-semibold text-ink">{selectedHousehold.representative}</p>
                <p className="mt-1 text-sm text-ink/70">{selectedHousehold.code} · {selectedHousehold.purokName}</p>
                <p className="mt-2 text-sm text-ink/60">{selectedHousehold.address}</p>
              </div>

              <div className="rounded-2xl border border-line bg-paper/70 p-4 text-sm text-ink/70">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-ink">Last collection</span>
                  {lastCollectionLog && <StatusBadge status={lastCollectionLog.status} />}
                </div>
                <p className="mt-2 text-sm text-ink/60">{lastCollectionLog?.date ?? "No recent log"}</p>
              </div>

              {duplicateMessage && (
                <div className="rounded-2xl border border-clay/20 bg-clay-tint p-4 text-sm text-clay">
                  {duplicateMessage}
                </div>
              )}

              <div className="space-y-2">
                <p className="text-sm font-semibold text-ink">Choose an action</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { key: "collected", label: "Mark Collected" },
                    { key: "violation", label: "Report Violation" },
                    { key: "note", label: "Add Note" },
                  ].map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => setAction(option.key as "collected" | "violation" | "note")}
                      className={`rounded-full border px-3 py-1.5 text-sm ${action === option.key ? "border-pine bg-pine-tint text-pine-dark" : "border-line bg-paper text-ink/65"}`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

                {action !== "note" && (
                  <div className="space-y-1.5 pt-1">
                    <p className="text-sm font-semibold text-ink">Who disposed of the trash?</p>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { key: "owner", label: "Household Representative" },
                        { key: "representative", label: "Family Member / Other Person" },
                      ].map((option) => (
                        <button
                          key={option.key}
                          type="button"
                          onClick={() => setDisposedBy(option.key as "owner" | "representative")}
                          className={`rounded-full border px-3 py-1.5 text-sm ${disposedBy === option.key ? "border-pine bg-pine-tint text-pine-dark" : "border-line bg-paper text-ink/65"}`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                    {!disposedBy && (
                      <p className="text-xs text-clay">Select who disposed of the trash to continue.</p>
                    )}
                  </div>
                )}

                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Add a short note for the field visit"
                  className="min-h-[92px] w-full rounded-2xl border border-line bg-paper px-3 py-2.5 text-sm text-ink outline-none focus:border-pine"
                />
                <button
                  type="button"
                  onClick={handleAction}
                  disabled={submitting || (action !== "note" && !disposedBy)}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-pine px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-pine-dark disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <Loader2 size={15} className="animate-spin" /> Saving…
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={15} /> Save action
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleRescan}
                  disabled={submitting}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border border-line bg-paper px-4 py-2.5 text-sm font-medium text-ink/70 hover:border-pine/40 disabled:opacity-50"
                >
                  <ScanLine size={15} /> Scan another household
                </button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
