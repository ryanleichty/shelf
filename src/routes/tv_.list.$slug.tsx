import { createFileRoute, notFound } from "@tanstack/react-router"
import { z } from "zod"
import { ListCatalog } from "@/components/list-catalog"
import { getItemsByList } from "@/server/items"

export const Route = createFileRoute("/tv_/list/$slug")({
  validateSearch: z.object({ query: z.string().optional() }),
  loaderDeps: ({ search }) => ({ query: search.query }),
  loader: async ({ deps, params }) => {
    const result = await getItemsByList({
      data: { listSlug: params.slug, type: "tv", query: deps.query },
    })
    if (!result) throw notFound()
    return result
  },
  component: TVList,
})

function TVList() {
  const navigate = Route.useNavigate()
  const search = Route.useSearch()
  const { collageItems, items, name, totalCount } = Route.useLoaderData()
  return (
    <ListCatalog
      collageItems={collageItems}
      items={items}
      name={name}
      onQueryChange={(query) =>
        navigate({ search: { query: query || undefined } })
      }
      query={search.query}
      totalCount={totalCount}
      type="tv"
    />
  )
}
