import { Link, createFileRoute } from "@tanstack/react-router"
import { PlusIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Catalog } from "@/components/catalog"
import { OutNow } from "@/components/out-now"
import { getItems } from "@/server/items"

export const Route = createFileRoute("/movies")({
  loader: () => getItems({ data: { type: "movie" } }),
  component: Movies,
})

function Movies() {
  return (
    <main className="container mx-auto max-w-6xl px-4 py-10">
      <section className="mb-8 flex items-end justify-between gap-4">
        <div><p className="text-sm text-muted-foreground">The film shelf</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Movies</h1></div>
        <Button render={<Link search={{ type: "movie" }} to="/admin/new" />}><PlusIcon /> Add movie</Button>
      </section>
      <OutNow items={Route.useLoaderData()} />
      <Catalog items={Route.useLoaderData()} type="movie" />
    </main>
  )
}
