import { Link, createFileRoute, redirect, useRouter } from "@tanstack/react-router"
import { LogOut, Pencil, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { deleteItem, getAdminStatus, getItems, logout } from "@/server/items"

export const Route = createFileRoute("/admin/")({
  beforeLoad: async () => {
    if (!(await getAdminStatus())) throw redirect({ to: "/admin/login" })
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
    <main className="page admin-page">
      <div className="admin-header">
        <div><p className="eyebrow">Private index</p><h1>On the shelf</h1></div>
        <div className="admin-actions">
          <Link className="add-link" to="/admin/new"><Plus size={16} /> Add an item</Link>
          <Button onClick={signOut} size="icon" title="Log out" variant="ghost"><LogOut /></Button>
        </div>
      </div>
      <div className="admin-list">
        {items.map((item) => (
          <div className="admin-row" key={item.id}>
            <div><span className="admin-type">{item.type}</span><h2>{item.title}</h2><p>{item.creator} · {item.year}</p></div>
            <div className="row-actions">
              <Link className="icon-link" params={{ id: String(item.id) }} title={`Edit ${item.title}`} to="/admin/$id"><Pencil size={16} /></Link>
              <Button onClick={() => remove(item.id, item.title)} size="icon" title={`Remove ${item.title}`} variant="ghost"><Trash2 /></Button>
            </div>
          </div>
        ))}
      </div>
    </main>
  )
}
