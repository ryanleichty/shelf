import { Link, createFileRoute } from "@tanstack/react-router"
import { useEffect, useState } from "react"
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
      billboards: billboardItems,
      rows,
    }
  },
  component: Home,
})

function Home() {
  const { billboards, rows } = Route.useLoaderData()
  const [tmdbDetails, setTmdbDetails] = useState<
    Record<string, { logoUrl: string | null; tagline: string | null }>
  >({})
  const [tmdbTrailers, setTmdbTrailers] = useState<
    Record<string, { key: string } | null>
  >({})

  useEffect(() => {
    for (const billboard of billboards) {
      const key = billboard.id
      void getTmdbBillboardDetails({
        data: { tmdbId: billboard.tmdbId, type: billboard.type },
      }).then((details) =>
        setTmdbDetails((current) => ({ ...current, [key]: details }))
      )
      void getTmdbTrailer({
        data: { tmdbId: billboard.tmdbId, type: billboard.type },
      }).then((trailer) =>
        setTmdbTrailers((current) => ({ ...current, [key]: trailer }))
      )
    }
  }, [billboards])

  const enrichedBillboards = billboards.map((item) => ({
    item,
    details: tmdbDetails[item.id] ?? { logoUrl: null, tagline: null },
    trailer: tmdbTrailers[item.id] ?? null,
  }))

  return (
    <main className="overflow-x-hidden">
      <HomeBillboard billboards={enrichedBillboards} />
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
