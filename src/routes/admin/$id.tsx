import { createFileRoute, notFound, redirect } from "@tanstack/react-router"
import { ItemForm } from "@/components/item-form"
import { getAdminStatus, getItemById } from "@/server/items"

export const Route = createFileRoute("/admin/$id")({
  beforeLoad: async () => {
    if (!(await getAdminStatus())) throw redirect({ to: "/admin/login" })
  },
  loader: async ({ params }) => {
    const item = await getItemById({ data: { id: Number(params.id) } })
    if (!item) throw notFound()
    return item
  },
  component: EditItem,
})

function EditItem() {
  return <main className="page admin-page"><p className="eyebrow">Private index</p><h1>Edit item</h1><ItemForm item={Route.useLoaderData()} /></main>
}
