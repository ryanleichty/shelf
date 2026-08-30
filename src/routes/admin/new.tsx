import { createFileRoute, redirect } from "@tanstack/react-router"
import { z } from "zod"
import { ItemForm } from "@/components/item-form"
import { getSignedInStatus } from "@/server/items"

export const Route = createFileRoute("/admin/new")({
  validateSearch: z.object({ type: z.enum(["book", "movie", "tv"]).optional() }),
  beforeLoad: async () => {
    if (!(await getSignedInStatus())) throw redirect({ to: "/admin/login" })
  },
  component: NewItem,
})

function NewItem() {
  const { type } = Route.useSearch()
  return <main className="container mx-auto max-w-4xl px-4 py-10"><p className="text-sm text-muted-foreground">Private index</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Add to Shelf</h1><ItemForm initialType={type} /></main>
}
