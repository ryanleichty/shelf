import { Link, createFileRoute, redirect, useRouter } from "@tanstack/react-router"
import { LogOut, Pencil, Plus, Trash2, UploadIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { deleteItem, getItems, getSignedInStatus, logout } from "@/server/items"

export const Route = createFileRoute("/admin/")({
  beforeLoad: async () => {
    if (!(await getSignedInStatus())) throw redirect({ to: "/admin/login" })
  },
  loader: () => getItems({ data: {} }),
  component: Admin,
})

function Admin() {
  const items = Route.useLoaderData()
  const router = useRouter()
  async function remove(id: number, title: string) {
    if (!window.confirm(`Remove “${title}” from Shelf?`)) return
    await deleteItem({ data: { id } })
    await router.invalidate()
  }
  async function signOut() {
    await logout()
    await router.navigate({ to: "/admin/login" })
  }
  return (
    <main className="container mx-auto max-w-4xl px-4 py-10">
      <div className="mb-8 flex items-end justify-between">
        <div><p className="text-sm text-muted-foreground">Private index</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">On the shelf</h1></div>
        <div className="flex items-center gap-2">
          <Button render={<Link to="/admin/new" />}><Plus /> Add an item</Button>
          <Button render={<Link to="/admin/import" />} variant="outline"><UploadIcon /> Import</Button>
          <Button onClick={signOut} size="icon" title="Log out" variant="ghost"><LogOut /></Button>
        </div>
      </div>
      <div className="divide-y rounded-lg border">
        {items.map((item) => (
          <div className="flex items-center justify-between gap-4 p-4" key={item.id}>
            <div><span className="text-xs text-muted-foreground">{item.type}</span><h2 className="font-medium">{item.title}</h2><p className="text-sm text-muted-foreground">{item.creator} · {item.year}</p></div>
            <div className="flex gap-1">
              <Button render={<Link params={{ id: String(item.id) }} to="/admin/$id" />} size="icon" title={`Edit ${item.title}`} variant="ghost"><Pencil size={16} /></Button>
              <Button onClick={() => remove(item.id, item.title)} size="icon" title={`Remove ${item.title}`} variant="ghost"><Trash2 /></Button>
            </div>
          </div>
        ))}
      </div>
    </main>
  )
}
