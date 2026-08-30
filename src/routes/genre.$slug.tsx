import { createFileRoute, notFound } from "@tanstack/react-router"
import { Catalog } from "@/components/catalog"
import { getItemsByTag } from "@/server/items"

export const Route = createFileRoute("/genre/$slug")({
  loader: async ({ params }) => {
    const result = await getItemsByTag({
      data: { kind: "genre", slug: params.slug },
    })
    if (!result) throw notFound()
    return result
  },
  component: GenrePage,
})

function GenrePage() {
  const { name, items } = Route.useLoaderData()
  return (
    <main className="container mx-auto max-w-6xl px-4 py-10">
      <p className="text-sm text-muted-foreground">Genre</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">{name}</h1>
      <div className="mt-8">
        <Catalog
          hideGenreFilter={items.every((item) => item.genres.includes(name))}
          items={items}
        />
      </div>
    </main>
  )
}
