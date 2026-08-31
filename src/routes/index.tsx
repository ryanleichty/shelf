import { Link, createFileRoute } from "@tanstack/react-router"
import { HomeCarousel } from "@/components/home-carousel"
import { useSignedInStatus } from "@/components/signed-in-status"
import { SystemListToggle } from "@/components/system-list-toggle"
import { TrailerDialog } from "@/components/trailer-dialog"
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

    const billboardItem = items
      .filter(
        (item): item is typeof item & BillboardItem =>
          item.status === "owned" &&
          (item.type === "movie" || item.type === "tv") &&
          Boolean(item.backdropImageUrl) &&
          Boolean(item.tmdbId)
      )
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0]
    const [billboardDetails, trailer] = billboardItem
      ? await Promise.all([
          getTmdbBillboardDetails({
            data: { tmdbId: billboardItem.tmdbId, type: billboardItem.type },
          }),
          getTmdbTrailer({
            data: { tmdbId: billboardItem.tmdbId, type: billboardItem.type },
          }),
        ])
      : [null, null]
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
      billboard: billboardItem
        ? { item: billboardItem, details: billboardDetails, trailer }
        : null,
      rows,
    }
  },
  component: Home,
})

function Home() {
  const { billboard, rows } = Route.useLoaderData()
  const { signedIn } = useSignedInStatus()
  return (
    <main className="overflow-x-hidden py-10">
      <div className="container mx-auto mb-10 max-w-6xl px-4">
        <p className="text-sm text-muted-foreground">
          Ryan Leichty&apos;s collection
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Shelf</h1>
      </div>
      {billboard && (
        <section
          aria-label={`Featured ${billboard.item.type}`}
          className="relative isolate min-h-105 overflow-hidden bg-hero text-hero-foreground sm:min-h-120"
        >
          <img
            alt=""
            className="absolute inset-0 size-full object-cover opacity-70"
            referrerPolicy="no-referrer"
            src={billboard.item.backdropImageUrl}
          />
          {billboard.item.coverImageUrl && (
            <div className="absolute inset-y-0 right-0 hidden w-1/2 md:block">
              <img
                alt=""
                className="size-full object-cover opacity-70"
                referrerPolicy="no-referrer"
                src={billboard.item.coverImageUrl}
              />
              <div className="absolute inset-0 bg-linear-to-r from-hero via-hero/30 to-transparent" />
            </div>
          )}
          <div className="absolute inset-0 bg-linear-to-r from-hero via-hero/70 to-transparent" />
          <div className="absolute inset-0 bg-linear-to-t from-hero via-transparent to-hero/20" />
          <div className="relative container mx-auto flex min-h-105 max-w-6xl items-end px-4 py-10 sm:min-h-120 sm:items-center">
            <div className="max-w-md">
              <h2 className="sr-only">{billboard.item.title}</h2>
              {billboard.details?.logoUrl ? (
                <img
                  alt={billboard.item.title}
                  className="max-h-28 max-w-70 object-contain object-left"
                  referrerPolicy="no-referrer"
                  src={billboard.details.logoUrl}
                />
              ) : (
                <p className="text-4xl font-semibold tracking-tight sm:text-5xl">
                  {billboard.item.title}
                </p>
              )}
              {billboard.details?.tagline && (
                <p className="mt-5 text-lg text-hero-foreground/75">
                  {billboard.details.tagline}
                </p>
              )}
              <div className="mt-6 flex flex-wrap gap-2">
                {billboard.trailer && (
                  <TrailerDialog
                    showLabel
                    title={billboard.item.title}
                    trailerKey={billboard.trailer.key}
                  />
                )}
                {signedIn && (
                  <SystemListToggle
                    itemId={billboard.item.id}
                    list={{
                      slug: "watchlist",
                      name: "Watchlist",
                      containsItem: billboard.item.isInSystemList,
                    }}
                    showLabel
                  />
                )}
              </div>
            </div>
          </div>
        </section>
      )}
      {rows.length ? (
        <div className="mt-10 flex flex-col gap-10">
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
