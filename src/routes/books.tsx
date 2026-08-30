import { createFileRoute } from "@tanstack/react-router"
import { TypeHome } from "@/components/type-home"
import { getHomeRows } from "@/server/items"

export const Route = createFileRoute("/books")({
  loader: () => getHomeRows({ data: { type: "book" } }),
  component: Books,
})

function Books() {
  return (
    <TypeHome
      addLabel="Add book"
      rows={Route.useLoaderData()}
      subtitle="The book shelf"
      title="Books"
      type="book"
    />
  )
}
