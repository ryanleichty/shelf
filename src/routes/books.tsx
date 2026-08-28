import { createFileRoute } from "@tanstack/react-router"
import { Catalog } from "@/components/catalog"
import { getItems } from "@/server/items"

export const Route = createFileRoute("/books")({
  loader: () => getItems({ data: { type: "book" } }),
  component: Books,
})

function Books() {
  return (
    <main className="page">
      <section className="collection-heading">
        <p className="eyebrow">The book shelf</p>
        <h1>Books</h1>
      </section>
      <Catalog initialType="book" items={Route.useLoaderData()} />
    </main>
  )
}
