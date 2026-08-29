import { createFileRoute, notFound } from "@tanstack/react-router"
import { CoverTile } from "@/components/cover-tile"
import { getItemsByTag } from "@/server/items"

export const Route = createFileRoute("/keyword/$slug")({
  loader: async ({ params }) => {
    const result = await getItemsByTag({ data: { kind: "keyword", slug: params.slug } })
    if (!result) throw notFound()
    return result
  },
  component: KeywordPage,
})

function KeywordPage() {
  const { name, items } = Route.useLoaderData()
  return (
    <main className="container mx-auto max-w-6xl px-4 py-10">
      <p className="text-sm text-muted-foreground">Keyword</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">{name}</h1>
      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((item) => <CoverTile item={item} key={item.id} />)}
      </div>
    </main>
  )
}
