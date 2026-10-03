import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    globalSetup: ["./test/globalSetup.ts"],
    // Default (5000ms) is too tight once a test creates several fixtures
    // (each a real network round-trip to the isolated Neon database) before
    // making its own HTTP request(s) — not a hang, just cumulative latency.
    testTimeout: 20000,
  },
});
