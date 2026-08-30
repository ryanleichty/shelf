import { createFileRoute, notFound } from "@tanstack/react-router"
import { Catalog } from "@/components/catalog"
import { getItemsByCollection } from "@/server/items"

export const Route = createFileRoute("/collection/$slug")({
  loader: async ({ params }) => {
    const result = await getItemsByCollection({ data: { slug: params.slug } })
    if (!result) throw notFound()
    return result
  },
  component: CollectionPage,
})

function CollectionPage() {
  const { name, overview, items } = Route.useLoaderData()
  const isBookSeries =
    items.length > 0 && items.every((item) => item.type === "book")
  return (
    <main className="container mx-auto max-w-6xl px-4 py-10">
      <p className="text-sm text-muted-foreground">
        {isBookSeries ? "Series" : "Collection"}
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">{name}</h1>
      {overview && (
        <p className="mt-4 max-w-prose leading-7 text-muted-foreground">
          {overview}
        </p>
      )}
      <div className="mt-8">
        <Catalog items={items} type={isBookSeries ? "book" : "movie"} />
      </div>
    </main>
  )
}
