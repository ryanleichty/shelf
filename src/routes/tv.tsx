import { Link, createFileRoute } from "@tanstack/react-router"
import { PlusIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Catalog } from "@/components/catalog"
import { OutNow } from "@/components/out-now"
import { getItems } from "@/server/items"

export const Route = createFileRoute("/tv")({ loader: () => getItems({ data: { type: "tv" } }), component: TV })
function TV() { const items = Route.useLoaderData(); return <main className="container mx-auto max-w-6xl px-4 py-10"><section className="mb-8 flex items-end justify-between gap-4"><div><p className="text-sm text-muted-foreground">The television shelf</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">TV</h1></div><Button render={<Link search={{ type: "tv" }} to="/admin/new" />}><PlusIcon /> Add TV</Button></section><OutNow items={items} /><Catalog items={items} type="tv" /></main> }
