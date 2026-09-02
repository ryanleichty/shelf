import { createFileRoute, notFound } from "@tanstack/react-router"
import { useMemo } from "react"
import { Catalog } from "@/components/catalog"
import { genrePage } from "@/lib/catalog"
import { useCatalog } from "@/lib/use-catalog"

export const Route = createFileRoute("/genre/$slug")({ component: GenrePage })

function GenrePage() {
  const { slug } = Route.useParams()
  const catalog = useCatalog()
  const page = useMemo(() => genrePage(catalog, slug), [catalog, slug])
  if (!page) throw notFound()
  return (
    <main className="container mx-auto max-w-6xl px-4 py-10">
      <p className="text-sm text-muted-foreground">Genre</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">
        {page.name}
      </h1>
      <div className="mt-8">
        <Catalog
          hideGenreFilter={page.items.every((item) =>
            item.genres.includes(page.name)
          )}
          items={page.items}
        />
      </div>
    </main>
  )
}
