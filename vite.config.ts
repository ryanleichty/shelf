import { defineConfig } from "vite"
import { devtools } from "@tanstack/devtools-vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteReact from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { nitro } from "nitro/vite"
import { fileURLToPath } from "node:url"

const externalStoreSelectorShim = fileURLToPath(
  new URL("./src/lib/use-sync-external-store-with-selector.ts", import.meta.url)
)

const config = defineConfig({
  resolve: {
    alias: [
      {
        find: /^use-sync-external-store\/shim(?:\/index\.js)?$/,
        replacement: "react",
      },
      {
        find: /^use-sync-external-store\/shim\/with-selector(?:\.js)?$/,
        replacement: externalStoreSelectorShim,
      },
    ],
    tsconfigPaths: true,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("/src/")) return "app"
        },
      },
    },
  },
  plugins: [devtools(), tailwindcss(), tanstackStart(), nitro(), viteReact()],
})

export default config
