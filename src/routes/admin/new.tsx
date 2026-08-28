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
  return <main className="page admin-page"><p className="eyebrow">Private index</p><h1>Add to Shelf</h1><ItemForm /></main>
}
