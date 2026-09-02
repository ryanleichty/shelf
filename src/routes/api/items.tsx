import { createFileRoute } from "@tanstack/react-router"

const api = () => import("@/server/api/items")

export const Route = createFileRoute("/api/items")({
  server: {
    handlers: {
      GET: async (context) => (await api()).handlers.GET(context),
      POST: async (context) => (await api()).handlers.POST(context),
    },
  },
})
