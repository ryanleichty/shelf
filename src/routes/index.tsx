import { createFileRoute } from "@tanstack/react-router"
import { Catalog } from "@/components/catalog"
import { OutNow } from "@/components/out-now"
import { getItems } from "@/server/items"

export const Route = createFileRoute("/")({
  loader: () => getItems({ data: {} }),
  head: ({ loaderData }) => ({
    meta: [
      { title: "Shelf — Ryan Leichty" },
      { name: "description", content: "A small, personal library of movies and books." },
      { property: "og:title", content: "Shelf — Ryan Leichty" },
      { property: "og:description", content: "A small, personal library of movies and books." },
      ...(loaderData?.[0]?.coverImageUrl ? [{ property: "og:image", content: loaderData[0].coverImageUrl }] : []),
      { name: "twitter:card", content: loaderData?.[0]?.coverImageUrl ? "summary_large_image" : "summary" },
    ],
  }),
  component: App,
})

function App() {
  const items = Route.useLoaderData()
  return (
    <main className="container mx-auto max-w-6xl px-4 py-10">
      <section className="mb-10">
        <p className="text-sm text-muted-foreground">Ryan Leichty’s collection</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Movies and books</h1>
        <p className="mt-3 text-muted-foreground">A small, personal library of stories worth returning to.</p>
      </section>
      <OutNow items={items} />
      <Catalog items={items} />
    </main>
  )
}
