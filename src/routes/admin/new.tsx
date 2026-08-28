import { createFileRoute, redirect } from "@tanstack/react-router"
import { ItemForm } from "@/components/item-form"
import { getAdminStatus } from "@/server/items"

export const Route = createFileRoute("/admin/new")({
  beforeLoad: async () => {
    if (!(await getAdminStatus())) throw redirect({ to: "/admin/login" })
  },
  component: NewItem,
})

function NewItem() {
  return <main className="container mx-auto max-w-4xl px-4 py-10"><p className="text-sm text-muted-foreground">Private index</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Add to Shelf</h1><ItemForm /></main>
}
