import { createFileRoute } from "@tanstack/react-router"

const api = () => import("@/server/api/sync")

export const Route = createFileRoute("/api/items/sync")({
  server: {
    handlers: {
      POST: async (context) => (await api()).handlers.POST(context),
    },
  },
})
