import { createFileRoute } from "@tanstack/react-router"

const api = () => import("@/server/api/export")

export const Route = createFileRoute("/api/export")({
  server: {
    handlers: {
      GET: async (context) => (await api()).handlers.GET(context),
    },
  },
})
