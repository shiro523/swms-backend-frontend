import type { NextConfig } from "next";

// Proxy same-origin /api/* calls to the Express backend. Keeping the browser on
// one origin means the httpOnly auth cookie is first-party — no CORS-credentials
// juggling. Override the target with BACKEND_URL in the environment if needed.
// Falls back to the backend's own dev-server default (see backend-swms's
// config/env.ts: PORT defaults to 8000) — production must set BACKEND_URL.
const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";

const nextConfig: NextConfig = {
  // Without this, Turbopack walks up from this directory looking for a
  // lockfile to infer the workspace root, finds one at the repo root too
  // (../package-lock.json, for the unrelated root-level `npm run dev`
  // convenience script), and warns about "additional lockfiles." This repo
  // is swms-frontend itself, not a workspace — pin it explicitly.
  turbopack: {
    root: __dirname,
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${BACKEND_URL}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
