import { Link, createFileRoute } from "@tanstack/react-router"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { useEffect, useState } from "react"
import { HomeCarousel } from "@/components/home-carousel"
import { useSignedInStatus } from "@/components/signed-in-status"
import { SystemListToggle } from "@/components/system-list-toggle"
import { TrailerDialog } from "@/components/trailer-dialog"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
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
      .slice(0, 6)
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
  const { signedIn } = useSignedInStatus()
  const [activeBillboardIndex, setActiveBillboardIndex] = useState(0)
  const [isBillboardPaused, setIsBillboardPaused] = useState(false)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)
  const billboard = billboards[activeBillboardIndex]

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    const updatePreference = () => setPrefersReducedMotion(mediaQuery.matches)
    updatePreference()
    mediaQuery.addEventListener("change", updatePreference)
    return () => mediaQuery.removeEventListener("change", updatePreference)
  }, [])

  useEffect(() => {
    if (billboards.length < 2 || isBillboardPaused || prefersReducedMotion)
      return
    const interval = window.setInterval(
      () =>
        setActiveBillboardIndex(
          (currentIndex) => (currentIndex + 1) % billboards.length
        ),
      9_000
    )
    return () => window.clearInterval(interval)
  }, [billboards.length, isBillboardPaused, prefersReducedMotion])

  useEffect(() => {
    setActiveBillboardIndex((currentIndex) =>
      Math.min(currentIndex, Math.max(billboards.length - 1, 0))
    )
  }, [billboards.length])

  function showBillboard(index: number) {
    setActiveBillboardIndex(
      (index + billboards.length) % Math.max(billboards.length, 1)
    )
  }

  return (
    <main className="overflow-x-hidden px-4 py-4 sm:px-6">
      {billboard && (
        <section
          aria-label={`Featured ${billboard.item.type}`}
          className="relative isolate min-h-105 overflow-hidden rounded-2xl bg-hero text-hero-foreground sm:min-h-120"
          onBlurCapture={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget))
              setIsBillboardPaused(false)
          }}
          onFocusCapture={() => setIsBillboardPaused(true)}
          onMouseEnter={() => setIsBillboardPaused(true)}
          onMouseLeave={() => setIsBillboardPaused(false)}
        >
          {billboards.map((candidate, index) => (
            <img
              alt=""
              className={cn(
                "absolute inset-0 size-full object-cover transition-opacity duration-700 motion-reduce:transition-none",
                index === activeBillboardIndex ? "opacity-70" : "opacity-0"
              )}
              key={candidate.item.id}
              referrerPolicy="no-referrer"
              src={candidate.item.backdropImageUrl}
            />
          ))}
          <div className="absolute inset-0 bg-linear-to-r from-hero via-hero/70 to-transparent" />
          <div className="absolute inset-0 bg-linear-to-t from-hero via-transparent to-hero/20" />
          <div className="relative flex min-h-105 items-end px-6 py-10 sm:min-h-120 sm:items-center sm:px-10">
            <div className="max-w-md">
              <h1 className="sr-only">{billboard.item.title}</h1>
              {billboard.details.logoUrl ? (
                <img
                  alt={billboard.item.title}
                  className="max-h-28 max-w-70 object-contain object-left drop-shadow-[0_1px_1px_rgb(0_0_0_/_0.8)]"
                  referrerPolicy="no-referrer"
                  src={billboard.details.logoUrl}
                />
              ) : (
                <p className="text-4xl font-semibold tracking-tight drop-shadow-[0_1px_1px_rgb(0_0_0_/_0.8)] sm:text-5xl">
                  {billboard.item.title}
                </p>
              )}
              <p className="mt-4 text-sm text-hero-foreground/75">
                {billboard.item.year}
                {billboard.item.certification?.trim() &&
                  ` · ${billboard.item.certification.trim()}`}
                {billboard.item.runtime && billboard.item.runtime > 0
                  ? ` · ${formatRuntime(billboard.item.runtime)}`
                  : ""}
              </p>
              {billboard.details.tagline && (
                <p className="mt-3 text-lg text-hero-foreground/75">
                  {billboard.details.tagline}
                </p>
              )}
              <div className="mt-6 flex flex-wrap gap-2">
                {billboard.trailer && (
                  <TrailerDialog
                    className="bg-hero-foreground text-hero hover:bg-hero-foreground/90"
                    showLabel
                    title={billboard.item.title}
                    trailerKey={billboard.trailer.key}
                  />
                )}
                {signedIn && (
                  <SystemListToggle
                    className="border-hero-foreground/60 bg-hero-foreground/95 text-hero hover:bg-hero-foreground hover:text-hero"
                    itemId={billboard.item.id}
                    list={{
                      slug: "watchlist",
                      name: "Watchlist",
                      containsItem: billboard.item.isInSystemList,
                    }}
                    showLabel
                    variant="outline"
                  />
                )}
              </div>
            </div>
          </div>
          {billboards.length > 1 && (
            <>
              <div className="absolute right-4 bottom-4 left-4 flex items-center justify-center gap-2">
                {billboards.map((candidate, index) => (
                  <Button
                    aria-label={`Show ${candidate.item.title}`}
                    aria-pressed={index === activeBillboardIndex}
                    className={cn(
                      "size-2 rounded-full bg-hero-foreground/40 p-0 hover:bg-hero-foreground",
                      index === activeBillboardIndex && "bg-hero-foreground"
                    )}
                    key={candidate.item.id}
                    onClick={() => showBillboard(index)}
                    size="icon-xs"
                    variant="ghost"
                  />
                ))}
              </div>
              <div className="absolute inset-y-0 right-0 left-0 flex items-center justify-between px-3">
                <Button
                  aria-label="Previous featured title"
                  className="bg-hero/50 text-hero-foreground hover:bg-hero/80 hover:text-hero-foreground"
                  onClick={() => showBillboard(activeBillboardIndex - 1)}
                  size="icon"
                  variant="ghost"
                >
                  <ChevronLeftIcon />
                </Button>
                <Button
                  aria-label="Next featured title"
                  className="bg-hero/50 text-hero-foreground hover:bg-hero/80 hover:text-hero-foreground"
                  onClick={() => showBillboard(activeBillboardIndex + 1)}
                  size="icon"
                  variant="ghost"
                >
                  <ChevronRightIcon />
                </Button>
              </div>
            </>
          )}
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

function formatRuntime(runtime: number) {
  const hours = Math.floor(runtime / 60)
  const minutes = runtime % 60
  if (!hours) return `${minutes}m`
  if (!minutes) return `${hours}h`
  return `${hours}h ${minutes}m`
}
