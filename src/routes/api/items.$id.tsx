import { createFileRoute } from "@tanstack/react-router"

const api = () => import("@/server/api/item")

export const Route = createFileRoute("/api/items/$id")({
  server: {
    handlers: {
      PATCH: async (context) => (await api()).handlers.PATCH(context),
      DELETE: async (context) => (await api()).handlers.DELETE(context),
    },
  },
})
