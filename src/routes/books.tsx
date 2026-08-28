import { createFileRoute } from "@tanstack/react-router"
import { Catalog } from "@/components/catalog"
import { OutNow } from "@/components/out-now"
import { getItems } from "@/server/items"

export const Route = createFileRoute("/books")({
  loader: () => getItems({ data: { type: "book" } }),
  component: Books,
})

function Books() {
  return (
    <main className="container mx-auto max-w-6xl px-4 py-10">
      <section className="mb-8">
        <p className="text-sm text-muted-foreground">The book shelf</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Books</h1>
      </section>
      <OutNow items={Route.useLoaderData()} />
      <Catalog items={Route.useLoaderData()} type="book" />
    </main>
  )
}
