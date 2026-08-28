import { createFileRoute } from "@tanstack/react-router"
import { Catalog } from "@/components/catalog"
import { getItems } from "@/server/items"

export const Route = createFileRoute("/")({
  loader: () => getItems({ data: {} }),
  component: App,
})

function App() {
  const items = Route.useLoaderData()
  return (
    <main className="page">
      <section className="catalog-intro">
        <p className="eyebrow">Ryan Leichty’s collection</p>
        <h1>Movies and books,<br />kept close.</h1>
        <p className="lede">A small, personal library of stories worth returning to.</p>
      </section>
      <Catalog items={items} />
    </main>
  )
}
