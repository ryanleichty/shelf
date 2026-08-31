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
    const tonightItems = items
      .filter(
        (item) =>
          item.isInSystemList && (item.type === "movie" || item.type === "tv")
      )
      .sort(compareTonightItems)

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
      tonightItems,
      rows,
    }
  },
  component: Home,
})

function Home() {
  const { billboards, tonightItems, rows } = Route.useLoaderData()
  return (
    <main className="overflow-x-hidden">
      <HomeBillboard billboards={billboards} />
      {tonightItems.length || rows.length ? (
        <div className="mt-10 flex flex-col gap-10 pb-10">
          {tonightItems.length > 0 && (
            <section className="overflow-x-hidden">
              <div className="container mx-auto mb-4 max-w-6xl px-4">
                <h2 className="text-xl font-semibold tracking-tight">
                  Tonight
                </h2>
                <p className="text-sm text-muted-foreground">
                  {tonightItems.length}{" "}
                  {tonightItems.length === 1 ? "title" : "titles"}
                  {formatTonightRuntime(tonightItems)}
                </p>
              </div>
              <HomeCarousel id="home-tonight" items={tonightItems} />
            </section>
          )}
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

function validRuntime(runtime: number | null): runtime is number {
  return typeof runtime === "number" && Number.isInteger(runtime) && runtime > 0
}

function compareTonightItems(
  left: { runtime: number | null },
  right: { runtime: number | null }
) {
  const leftRuntime = validRuntime(left.runtime) ? left.runtime : Infinity
  const rightRuntime = validRuntime(right.runtime) ? right.runtime : Infinity
  const leftGroup = leftRuntime <= 120 ? 0 : leftRuntime === Infinity ? 2 : 1
  const rightGroup = rightRuntime <= 120 ? 0 : rightRuntime === Infinity ? 2 : 1

  return leftGroup - rightGroup || leftRuntime - rightRuntime
}

function formatTonightRuntime(items: Array<{ runtime: number | null }>) {
  const runtime = items.reduce(
    (total, item) => total + (validRuntime(item.runtime) ? item.runtime : 0),
    0
  )

  return runtime ? ` · ${formatRuntime(runtime)}` : ""
}

function formatRuntime(runtime: number) {
  const hours = Math.floor(runtime / 60)
  const minutes = runtime % 60
  return hours ? `${hours}h ${minutes}m` : `${minutes}m`
}
