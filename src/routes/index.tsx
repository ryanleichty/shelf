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
        (item): item is typeof item & { runtime: number } =>
          item.isInSystemList &&
          (item.type === "movie" || item.type === "tv") &&
          validRuntime(item.runtime)
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
                  {formatTonightRuntime(tonightItems)}
                </p>
              </div>
              <div className="container mx-auto flex max-w-6xl flex-col gap-3 px-4">
                {tonightItems.map((item) => (
                  <Link
                    className="flex items-center gap-3"
                    key={item.id}
                    params={{ slug: item.slug }}
                    to="/item/$slug"
                  >
                    <div className="aspect-2/3 w-12 shrink-0 overflow-hidden rounded-md bg-muted">
                      {item.coverImageUrl && (
                        <img
                          alt=""
                          className="h-full w-full object-cover"
                          referrerPolicy="no-referrer"
                          src={item.coverImageUrl}
                        />
                      )}
                    </div>
                    <div>
                      <p>{item.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {item.certification?.trim()
                          ? `${item.certification.trim()} · `
                          : ""}
                        {formatRuntime(item.runtime)}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
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
  left: { runtime: number },
  right: { runtime: number }
) {
  const leftGroup = left.runtime <= 120 ? 0 : 1
  const rightGroup = right.runtime <= 120 ? 0 : 1

  return leftGroup - rightGroup || left.runtime - right.runtime
}

function formatTonightRuntime(items: Array<{ runtime: number }>) {
  return formatRuntime(items.reduce((total, item) => total + item.runtime, 0))
}

function formatRuntime(runtime: number) {
  const hours = Math.floor(runtime / 60)
  const minutes = runtime % 60
  return hours ? `${hours}h ${minutes}m` : `${minutes}m`
}
