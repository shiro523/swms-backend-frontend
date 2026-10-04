"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { Camera, CheckCircle2, ScanLine, TriangleAlert, RotateCcw, AlertCircle, Loader2 } from "lucide-react";
import Link from "next/link";
import { Card, PageHeader } from "@/components/ui/Primitives";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { api, ApiError } from "@/lib/api";
import { Household, TrashLog } from "@/lib/types";

const SCANNER_ELEMENT_ID = "qr-reader";

// Only QR codes (skips trying ~15 barcode formats on every frame), and the
// browser's native BarcodeDetector where available (Chrome/Edge/Android),
// which decodes far faster and more reliably than the JS fallback.
const SCANNER_CONFIG = {
  verbose: false,
  formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
  useBarCodeDetectorIfSupported: true,
};

// Only the area inside qrbox is decoded, so make it most of the frame (70%
// of the shorter side) instead of a fixed 240px square that was a small
// slice of a large video.
function qrboxSize(viewfinderWidth: number, viewfinderHeight: number) {
  const size = Math.max(160, Math.floor(Math.min(viewfinderWidth, viewfinderHeight) * 0.7));
  return { width: size, height: size };
}

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
  const [action, setAction] = useState<"collected" | "violation">("collected");
  // No default — the leader must explicitly pick who disposed of the trash
  // rather than silently falling back to the backend's "representative"
  // default, which could record an incorrect person for every scan.
  const [disposedBy, setDisposedBy] = useState<"owner" | "representative" | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // Confirmation of the last saved log, shown in the empty result panel
  // while the camera is back to scanning for the next household.
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  const [purokName, setPurokName] = useState("");
  const [logs, setLogs] = useState<TrashLog[]>([]);
  const householdsRef = useRef<Household[]>([]);
  const logsRef = useRef<TrashLog[]>([]);
  // First day (YYYY-MM-DD) of the current weekly collection window, from the
  // server; null until loaded, when the hint falls back to today only.
  const weekStartRef = useRef<string | null>(null);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isMountedRef = useRef(true);
  // True once a scan has been matched, until "Scan another household" —
  // the library can fire the success callback for several frames in a row
  // before stop() takes effect.
  const decodeHandledRef = useRef(false);
  // Every camera start/stop runs through this queue, one at a time. Without
  // it, React Strict Mode's dev-only mount -> unmount -> mount started a
  // second camera stream while the first start() was still pending (so the
  // cleanup's stop() saw nothing to stop), leaving two live videos stacked
  // in the same viewfinder.
  const cameraQueueRef = useRef<Promise<void>>(Promise.resolve());

  const runCameraTask = useCallback((task: () => Promise<void>) => {
    const run = cameraQueueRef.current.then(task);
    cameraQueueRef.current = run.catch(() => undefined);
    return run;
  }, []);

  // Load the leader's households (for QR matching), existing logs and the
  // current collection week (for the "already collected this week" hint).
  // The backend re-checks scope and duplicates on save.
  useEffect(() => {
    let cancelled = false;
    Promise.all([api.puroks(), api.households(), api.trashLogs(), api.collectionWeek()])
      .then(([puroks, households, trashLogs, collectionWeek]) => {
        if (cancelled) return;
        setPurokName(puroks[0]?.name ?? "");
        householdsRef.current = households;
        weekStartRef.current = collectionWeek.weekStart;
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
    if (decodeHandledRef.current) return;
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

    // Trash is collected weekly: one log per household per collection week.
    // An automatic "missed" log doesn't count — a late pickup replaces it.
    const weekStart = weekStartRef.current ?? todayIso();
    const existingLog = logsRef.current.find(
      (log) => log.householdId === matchedHousehold.id && log.date >= weekStart && log.status !== "missed",
    );
    const alreadyCollected = Boolean(existingLog);
    const message = existingLog
      ? `Already logged this collection week (${existingLog.date}${existingLog.time ? ` at ${existingLog.time}` : ""}).`
      : `Matched ${matchedHousehold.code}.`;

    decodeHandledRef.current = true;
    setSelectedHousehold(matchedHousehold);
    setScannerState(alreadyCollected ? "error" : "success");
    setStatusMessage(message);
    setDuplicateMessage(alreadyCollected ? message : null);
    setCameraError(null);

    await runCameraTask(async () => {
      if (html5QrCode.isScanning) {
        await html5QrCode.stop().catch(() => undefined);
      }
    });
  }, [runCameraTask]);

  const startScanning = useCallback(async (html5QrCode: Html5Qrcode, isCancelled: () => boolean) => {
    await html5QrCode.start(
      { facingMode: "environment" },
      {
        fps: 15,
        qrbox: qrboxSize,
        // Ask for HD — the browser default (often 640x480) leaves a printed
        // sticker only a few dozen pixels wide unless held very close.
        // "ideal" values fall back gracefully on cameras that can't do it.
        videoConstraints: {
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      },
      (decodedText) => {
        if (isCancelled()) return;
        void handleDecoded(html5QrCode, decodedText);
      },
      () => undefined,
    );
  }, [handleDecoded]);

  useEffect(() => {
    isMountedRef.current = true;
    // Per-run flag (not isMountedRef): in Strict Mode the remount flips
    // isMountedRef back to true before the first run's queued start gets its
    // turn, and that stale start must still be skipped.
    let active = true;
    let html5QrCode: Html5Qrcode | null = null;

    void runCameraTask(async () => {
      if (!active) return;
      html5QrCode = new Html5Qrcode(SCANNER_ELEMENT_ID, SCANNER_CONFIG);
      scannerRef.current = html5QrCode;
      try {
        await startScanning(html5QrCode, () => !active);
        if (!active) return; // the queued cleanup below stops it
        setScannerState("scanning");
        setStatusMessage("Camera is live. Point it at a household QR sticker.");
        setCameraError(null);
      } catch (error) {
        if (!active) return;
        const fallbackMessage = error instanceof Error ? error.message : "Unable to access the camera.";
        setScannerState("error");
        setStatusMessage("Camera permission denied or unavailable.");
        setCameraError(fallbackMessage);
      }
    });

    return () => {
      active = false;
      isMountedRef.current = false;
      void runCameraTask(async () => {
        const scanner = html5QrCode;
        if (!scanner) return;
        if (scanner.isScanning) {
          await scanner.stop().catch(() => undefined);
        }
        try {
          scanner.clear();
        } catch {
          // ignore — element may already be detached during unmount
        }
        if (scannerRef.current === scanner) scannerRef.current = null;
      });
    };
  }, [startScanning, runCameraTask]);

  // Clears the result panel and restarts the camera. `savedNotice` (after a
  // successful save) is shown in the empty panel so the leader can see the
  // log went through while moving on to the next household.
  async function handleRescan(savedNotice?: string) {
    setSavedMessage(savedNotice ?? null);
    setSelectedHousehold(null);
    setDuplicateMessage(null);
    setCameraError(null);
    setNote("");
    setAction("collected");
    setDisposedBy(null);

    decodeHandledRef.current = false;

    try {
      await runCameraTask(async () => {
        const html5QrCode = scannerRef.current;
        if (!html5QrCode || !isMountedRef.current) return;
        if (!html5QrCode.isScanning) {
          await startScanning(html5QrCode, () => !isMountedRef.current);
        }
      });
      // If the page unmounted meanwhile, its queued cleanup stops the camera.
      if (!isMountedRef.current) return;

      setScannerState("scanning");
      setStatusMessage(
        savedNotice
          ? `${savedNotice} Ready for the next household.`
          : "Camera is live. Point it at a household QR sticker.",
      );
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

      // Done with this household: clear the form and go straight back to
      // scanning. Leaving the saved household and its form on screen made a
      // successful save look like nothing happened, inviting a second save
      // that the backend then rejects as a same-day duplicate.
      await handleRescan(
        `Logged ${action === "violation" ? "violation" : "collection"} for ${selectedHousehold.code} (${selectedHousehold.representative}).`,
      );
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

          {/* The scanner library draws the only frame overlay itself — shaded
              edges with corner guides marking exactly the area it decodes. */}
          <div className="min-h-[340px] bg-[#0d1f18]">
            <div id={SCANNER_ELEMENT_ID} className="min-h-[340px] w-full" />
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
            <>
              {savedMessage && (
                <div className="mt-4 flex items-start gap-2 rounded-2xl border border-pine/20 bg-pine-tint p-4 text-sm text-pine-dark">
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
                  <span>{savedMessage}</span>
                </div>
              )}
              <div className="mt-4 rounded-2xl border border-dashed border-line bg-paper/50 p-6 text-center text-sm text-ink/55">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-panel">
                  <AlertCircle size={18} className="text-ink/40" />
                </div>
                <p className="mt-3 font-medium text-ink">Awaiting scan</p>
                <p className="mt-1">The household details will appear here after a valid QR is scanned.</p>
              </div>
            </>
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
                  ].map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => setAction(option.key as "collected" | "violation")}
                      className={`rounded-full border px-3 py-1.5 text-sm ${action === option.key ? "border-pine bg-pine-tint text-pine-dark" : "border-line bg-paper text-ink/65"}`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

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
                  {!disposedBy && !duplicateMessage && (
                    <p className="text-xs text-clay">Select who disposed of the trash to continue.</p>
                  )}
                </div>

                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Optional note — saved with this trash log"
                  className="min-h-[92px] w-full rounded-2xl border border-line bg-paper px-3 py-2.5 text-sm text-ink outline-none focus:border-pine"
                />
                <button
                  type="button"
                  onClick={handleAction}
                  // Already logged today (found at scan time or rejected by the
                  // server): a second collection/violation can't be saved.
                  disabled={submitting || !disposedBy || duplicateMessage !== null}
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
                  onClick={() => void handleRescan()}
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
