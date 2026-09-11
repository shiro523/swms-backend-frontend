"use client";

import { useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Download, Printer, WifiOff } from "lucide-react";
import { Card } from "@/components/ui/Primitives";
import type { Household } from "@/lib/types";

export function QrSticker({ household }: { household: Household }) {
  const wrapRef = useRef<HTMLDivElement>(null);

  // Just the bare code — the purok-leader's scanner matches this string
  // directly against household codes it already has loaded.
  const payload = household.code;

  // Rasterize the rendered QR <svg> to a PNG and download it.
  const handleSave = () => {
    const svg = wrapRef.current?.querySelector("svg");
    if (!svg) return;
    const xml = new XMLSerializer().serializeToString(svg);
    const svgDataUrl = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(xml)));

    const img = new Image();
    img.onload = () => {
      const size = 600;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(img, 0, 0, size, size);
      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${household.code}-qr.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, "image/png");
    };
    img.src = svgDataUrl;
  };

  return (
    <Card className="flex flex-col items-center gap-4 p-8">
      <div ref={wrapRef} className="rounded-2xl border-2 border-dashed border-pine/30 bg-white p-5">
        <QRCodeSVG value={payload} size={200} fgColor="#123c31" bgColor="#ffffff" level="M" />
      </div>
      <div className="text-center">
        <p className="font-[family-name:var(--font-display)] text-lg font-semibold text-ink">
          {household.representative}
        </p>
        <p className="stamp text-xs text-ink/45">{household.code} · {household.purokName}</p>
      </div>
      <div className="no-print flex w-full gap-2">
        <button
          onClick={() => window.print()}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-line bg-paper px-3.5 py-2.5 text-[13px] font-medium text-ink/70 hover:border-pine/40"
        >
          <Printer size={14} /> Print sticker
        </button>
        <button
          onClick={handleSave}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-pine px-3.5 py-2.5 text-[13px] font-semibold text-white hover:bg-pine-dark"
        >
          <Download size={14} /> Save image
        </button>
      </div>
      <p className="no-print flex items-center gap-1.5 text-[11px] text-ink/40">
        <WifiOff size={12} /> Available offline once this page has loaded
      </p>
    </Card>
  );
}
