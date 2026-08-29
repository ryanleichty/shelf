import { createFileRoute, notFound, redirect } from "@tanstack/react-router"
import { ItemForm } from "@/components/item-form"
import { getItemById, getSignedInStatus } from "@/server/items"

export const Route = createFileRoute("/admin/$id")({
  beforeLoad: async () => {
    if (!(await getSignedInStatus())) throw redirect({ to: "/admin/login" })
  },
  loader: async ({ params }) => {
    const item = await getItemById({ data: { id: Number(params.id) } })
    if (!item) throw notFound()
    return item
  },
  component: EditItem,
})

function EditItem() {
  return <main className="container mx-auto max-w-4xl px-4 py-10"><p className="text-sm text-muted-foreground">Private index</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Edit item</h1><ItemForm item={Route.useLoaderData()} /></main>
}
