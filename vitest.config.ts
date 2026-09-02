import { defineConfig } from "vitest/config"

// Kept apart from vite.config.ts so tests don't boot the Start/Nitro plugins.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: { include: ["src/**/*.test.{ts,tsx}"] },
})
