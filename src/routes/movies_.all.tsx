import { createFileRoute } from "@tanstack/react-router"
import { useMemo } from "react"
import { z } from "zod"
import { AllCatalog } from "@/components/all-catalog"
import { itemsOfType } from "@/lib/catalog"
import { useCatalog } from "@/lib/use-catalog"

export const Route = createFileRoute("/movies_/all")({
  validateSearch: z.object({ query: z.string().optional() }),
  component: AllMovies,
})

function AllMovies() {
  const navigate = Route.useNavigate()
  const search = Route.useSearch()
  const catalog = useCatalog()
  const items = useMemo(() => itemsOfType(catalog, "movie"), [catalog])
  return (
    <AllCatalog
      addLabel="Add movie"
      items={items}
      onQueryChange={(query) =>
        navigate({ replace: true, search: { query: query || undefined } })
      }
      query={search.query}
      subtitle="The film shelf"
      title="Movies"
      type="movie"
    />
  )
}
