import { defineConfig } from "vitest/config";

// Minimal Vitest config for badge. Tests live next to source in src/**/__tests__ and in
// eval/. Node environment (the CLI is headless). No transforms needed — vitest reads TS.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/__tests__/**/*.test.ts", "eval/**/*.test.ts"],
    globals: false,
  },
});
