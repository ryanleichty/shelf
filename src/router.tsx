import { createRouter as createTanStackRouter } from "@tanstack/react-router"
import { PendingShelf } from "@/components/pending-shelf"
import { routeTree } from "./routeTree.gen"

export function getRouter() {
  const router = createTanStackRouter({
    routeTree,

    scrollRestoration: true,
    defaultPreload: "intent",
    defaultStaleTime: 5 * 60 * 1000,
    defaultPendingMs: 150,
    defaultPendingMinMs: 300,
    defaultPendingComponent: PendingShelf,
    defaultViewTransition: true,
  })

  return router
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
