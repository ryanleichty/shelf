import { Link, createFileRoute } from "@tanstack/react-router"
import { PlusIcon } from "lucide-react"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Catalog } from "@/components/catalog"
import { OutNow } from "@/components/out-now"
import { getItems } from "@/server/items"

export const Route = createFileRoute("/tv")({
  validateSearch: z.object({ query: z.string().optional() }),
  loader: ({ search }) => getItems({ data: { type: "tv", query: search.query } }),
  component: TV,
})

function TV() {
  const items = Route.useLoaderData()
  const navigate = Route.useNavigate()
  const search = Route.useSearch()
  return <main className="container mx-auto max-w-6xl px-4 py-10"><section className="mb-8 flex items-end justify-between gap-4"><div><p className="text-sm text-muted-foreground">The television shelf</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">TV</h1></div><Button render={<Link search={{ type: "tv" }} to="/admin/new" />}><PlusIcon /> Add TV</Button></section><OutNow items={items} /><Catalog items={items} onQueryChange={(query) => navigate({ search: { query: query || undefined } })} query={search.query} type="tv" /></main>
}
