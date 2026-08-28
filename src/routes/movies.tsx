import { createFileRoute } from "@tanstack/react-router"
import { Catalog } from "@/components/catalog"
import { getItems } from "@/server/items"

export const Route = createFileRoute("/movies")({
  loader: () => getItems({ data: { type: "movie" } }),
  component: Movies,
})

function Movies() {
  return (
    <main className="page">
      <section className="collection-heading">
        <p className="eyebrow">The film shelf</p>
        <h1>Movies</h1>
      </section>
      <Catalog initialType="movie" items={Route.useLoaderData()} />
    </main>
  )
}
