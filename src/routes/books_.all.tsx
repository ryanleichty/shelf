import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"
import { AllCatalog } from "@/components/all-catalog"
import { getItems } from "@/server/items"

export const Route = createFileRoute("/books_/all")({
  validateSearch: z.object({ query: z.string().optional() }),
  loaderDeps: ({ search }) => ({ query: search.query }),
  loader: ({ deps }) => getItems({ data: { type: "book", query: deps.query } }),
  component: AllBooks,
})

function AllBooks() {
  const navigate = Route.useNavigate()
  const search = Route.useSearch()
  return (
    <AllCatalog
      addLabel="Add book"
      items={Route.useLoaderData()}
      onQueryChange={(query) =>
        navigate({ replace: true, search: { query: query || undefined } })
      }
      query={search.query}
      subtitle="The book shelf"
      title="Books"
      type="book"
    />
  )
}
