import { createFileRoute, notFound } from "@tanstack/react-router"
import { z } from "zod"
import { ListCatalog } from "@/components/list-catalog"
import { getItemsByList } from "@/server/items"

export const Route = createFileRoute("/movies_/list/$slug")({
  validateSearch: z.object({ query: z.string().optional() }),
  loaderDeps: ({ search }) => ({ query: search.query }),
  loader: async ({ deps, params }) => {
    const result = await getItemsByList({
      data: { listSlug: params.slug, type: "movie", query: deps.query },
    })
    if (!result) throw notFound()
    return result
  },
  component: MovieList,
})

function MovieList() {
  const navigate = Route.useNavigate()
  const search = Route.useSearch()
  const { items, name } = Route.useLoaderData()
  return (
    <ListCatalog
      items={items}
      name={name}
      onQueryChange={(query) =>
        navigate({ search: { query: query || undefined } })
      }
      query={search.query}
      type="movie"
    />
  )
}
