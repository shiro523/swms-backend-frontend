import type { NextConfig } from "next";

// Proxy same-origin /api/* calls to the Express backend. Keeping the browser on
// one origin means the httpOnly auth cookie is first-party — no CORS-credentials
// juggling. Override the target with BACKEND_URL in the environment if needed.
const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:4000";

const nextConfig: NextConfig = {
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
