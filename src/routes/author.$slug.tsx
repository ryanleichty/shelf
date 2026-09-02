import { createFileRoute, notFound } from "@tanstack/react-router"
import { Catalog } from "@/components/catalog"
import { useCatalogItems } from "@/lib/use-catalog"
import { getItemsByPerson } from "@/server/items"

export const Route = createFileRoute("/author/$slug")({
  loader: async ({ params }) => {
    const result = await getItemsByPerson({
      data: { kind: "author", slug: params.slug },
    })
    if (!result) throw notFound()
    return result
  },
  component: AuthorPage,
})

function AuthorPage() {
  const { name, itemIds } = Route.useLoaderData()
  const items = useCatalogItems(itemIds)
  return (
    <main className="container mx-auto max-w-6xl px-4 py-10">
      <p className="text-sm text-muted-foreground">Author</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">{name}</h1>
      <div className="mt-8">
        <Catalog items={items} type="book" />
      </div>
    </main>
  )
}
