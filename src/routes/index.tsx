import { Link, createFileRoute } from "@tanstack/react-router"
import { HomeCarousel } from "@/components/home-carousel"
import { getItems } from "@/server/items"

export const Route = createFileRoute("/")({
  loader: async () => {
    const items = await getItems({ data: {} })
    return [
      {
        title: "Books",
        to: "/books" as const,
        items: items.filter((item) => item.type === "book"),
      },
      {
        title: "Movies",
        to: "/movies" as const,
        items: items.filter((item) => item.type === "movie"),
      },
      {
        title: "TV",
        to: "/tv" as const,
        items: items.filter((item) => item.type === "tv"),
      },
    ].filter((row) => row.items.length)
  },
  component: Home,
})

function Home() {
  const rows = Route.useLoaderData()
  return (
    <main className="overflow-x-hidden py-10">
      <div className="container mx-auto mb-10 max-w-6xl px-4">
        <p className="text-sm text-muted-foreground">
          Ryan Leichty&apos;s collection
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Shelf</h1>
      </div>
      {rows.length ? (
        <div className="flex flex-col gap-10">
          {rows.map((row, index) => (
            <section className="overflow-x-hidden" key={row.title}>
              <div className="container mx-auto mb-4 max-w-6xl px-4">
                <h2 className="text-xl font-semibold tracking-tight">
                  <Link className="hover:underline" to={row.to}>
                    {row.title}
                  </Link>
                </h2>
              </div>
              <HomeCarousel id={`home-row-${index}`} items={row.items} />
            </section>
          ))}
        </div>
      ) : (
        <div className="container mx-auto max-w-6xl px-4">
          <div className="rounded-lg border border-dashed p-12 text-center">
            <p className="font-medium">The shelf is empty.</p>
          </div>
        </div>
      )}
    </main>
  )
}
