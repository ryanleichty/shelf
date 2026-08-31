import { Link, createFileRoute } from "@tanstack/react-router"
import { HomeBillboard } from "@/components/home-billboard"
import { HomeCarousel } from "@/components/home-carousel"
import {
  getItems,
  getTmdbBillboardDetails,
  getTmdbTrailer,
} from "@/server/items"

type BillboardItem = {
  type: "movie" | "tv"
  tmdbId: string
  backdropImageUrl: string
}

export const Route = createFileRoute("/")({
  loader: async () => {
    const items = await getItems({ data: {} })
    const recentItemsFor = (type: "book" | "movie" | "tv") =>
      items
        .filter((item) => item.type === type)
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
        .slice(0, 12)

    const billboardItems = items
      .filter(
        (item): item is typeof item & BillboardItem =>
          item.status === "owned" &&
          (item.type === "movie" || item.type === "tv") &&
          Boolean(item.backdropImageUrl) &&
          Boolean(item.tmdbId)
      )
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .slice(0, 5)
    const billboards = await Promise.all(
      billboardItems.map(async (item) => {
        const [details, trailer] = await Promise.all([
          getTmdbBillboardDetails({
            data: { tmdbId: item.tmdbId, type: item.type },
          }),
          getTmdbTrailer({ data: { tmdbId: item.tmdbId, type: item.type } }),
        ])
        return { item, details, trailer }
      })
    )
    const rows = [
      { title: "Books", to: "/books" as const, items: recentItemsFor("book") },
      {
        title: "Movies",
        to: "/movies" as const,
        items: recentItemsFor("movie"),
      },
      { title: "TV", to: "/tv" as const, items: recentItemsFor("tv") },
    ].filter((row) => row.items.length)
    return {
      billboards,
      rows,
    }
  },
  component: Home,
})

function Home() {
  const { billboards, rows } = Route.useLoaderData()
  return (
    <main className="overflow-x-hidden">
      <HomeBillboard billboards={billboards} />
      {rows.length ? (
        <div className="mt-10 flex flex-col gap-10 pb-10">
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
