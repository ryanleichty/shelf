import { createFileRoute, notFound } from "@tanstack/react-router"
import { useMemo } from "react"
import { z } from "zod"
import { ListCatalog } from "@/components/list-catalog"
import { listPage } from "@/lib/catalog"
import { useCatalog } from "@/lib/use-catalog"

export const Route = createFileRoute("/movies_/list/$slug")({
  validateSearch: z.object({ query: z.string().optional() }),
  component: MovieList,
})

function MovieList() {
  const navigate = Route.useNavigate()
  const search = Route.useSearch()
  const { slug } = Route.useParams()
  const catalog = useCatalog()
  const page = useMemo(() => listPage(catalog, "movie", slug), [catalog, slug])
  if (!page) throw notFound()
  return (
    <ListCatalog
      collageItems={page.collageItems}
      items={page.items}
      name={page.name}
      onQueryChange={(query) =>
        navigate({ replace: true, search: { query: query || undefined } })
      }
      query={search.query}
      totalCount={page.totalCount}
      type="movie"
    />
  )
}
