import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"
import { AllCatalog } from "@/components/all-catalog"
import { getItems } from "@/server/items"

export const Route = createFileRoute("/tv_/all")({
  validateSearch: z.object({ query: z.string().optional() }),
  loaderDeps: ({ search }) => ({ query: search.query }),
  loader: ({ deps }) => getItems({ data: { type: "tv", query: deps.query } }),
  component: AllTV,
})

function AllTV() {
  const navigate = Route.useNavigate()
  const search = Route.useSearch()
  return (
    <AllCatalog
      addLabel="Add TV"
      items={Route.useLoaderData()}
      onQueryChange={(query) =>
        navigate({ replace: true, search: { query: query || undefined } })
      }
      query={search.query}
      subtitle="The television shelf"
      title="TV"
      type="tv"
    />
  )
}
