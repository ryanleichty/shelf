import { createFileRoute, notFound } from "@tanstack/react-router"
import { useMemo } from "react"
import { Catalog } from "@/components/catalog"
import { collectionPage } from "@/lib/catalog"
import { useCatalog } from "@/lib/use-catalog"

export const Route = createFileRoute("/collection/$slug")({
  component: CollectionPage,
})

function CollectionPage() {
  const { slug } = Route.useParams()
  const catalog = useCatalog()
  const page = useMemo(() => collectionPage(catalog, slug), [catalog, slug])
  if (!page) throw notFound()
  const isBookSeries =
    page.items.length > 0 && page.items.every((item) => item.type === "book")
  return (
    <main className="container mx-auto max-w-6xl px-4 py-10">
      <p className="text-sm text-muted-foreground">
        {isBookSeries ? "Series" : "Collection"}
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">
        {page.name}
      </h1>
      {page.overview && (
        <p className="mt-4 max-w-prose leading-7 text-muted-foreground">
          {page.overview}
        </p>
      )}
      <div className="mt-8">
        <Catalog items={page.items} type={isBookSeries ? "book" : "movie"} />
      </div>
    </main>
  )
}
