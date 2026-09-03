import { createFileRoute, Link } from "@tanstack/react-router"
import { PlusIcon } from "lucide-react"
import { z } from "zod"
import { Catalog } from "@/components/catalog"
import { Button } from "@/components/ui/button"
import { useCatalog } from "@/lib/use-catalog"

export const Route = createFileRoute("/wishlist")({
  validateSearch: z.object({ query: z.string().optional() }),
  component: Wishlist,
})

function Wishlist() {
  const navigate = Route.useNavigate()
  const search = Route.useSearch()
  const { wishlist } = useCatalog()
  return (
    <main className="container mx-auto max-w-6xl px-4 py-10">
      <section className="mb-8 flex items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Wishlist</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Things I don't own yet
          </h1>
        </div>
        <Button render={<Link search={{ wanted: true }} to="/admin/new" />}>
          <PlusIcon />
          Add to wishlist
        </Button>
      </section>
      <Catalog
        emptyDescription="Add a book, movie, or show you don't own yet."
        items={wishlist}
        onQueryChange={(query) =>
          navigate({ replace: true, search: { query: query || undefined } })
        }
        query={search.query}
        rememberQuery={false}
      />
    </main>
  )
}
