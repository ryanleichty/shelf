"use client"

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { useEffect, useState } from "react"
import { useSignedInStatus } from "@/components/signed-in-status"
import { SystemListToggle } from "@/components/system-list-toggle"
import { TrailerDialog } from "@/components/trailer-dialog"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { Item } from "@/server/schema"

type Billboard = {
  item: Item & {
    type: "movie" | "tv"
    tmdbId: string
    backdropImageUrl: string
  }
  details: { logoUrl: string | null; tagline: string | null }
  trailer: { key: string } | null
}

export function HomeBillboard({ billboards }: { billboards: Billboard[] }) {
  const { signedIn } = useSignedInStatus()
  const [activeIndex, setActiveIndex] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)
  const billboard = billboards[activeIndex]

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    const updatePreference = () => setPrefersReducedMotion(mediaQuery.matches)
    updatePreference()
    mediaQuery.addEventListener("change", updatePreference)
    return () => mediaQuery.removeEventListener("change", updatePreference)
  }, [])

  useEffect(() => {
    if (billboards.length < 2 || isPaused || prefersReducedMotion) return
    const interval = window.setInterval(
      () =>
        setActiveIndex(
          (currentIndex) => (currentIndex + 1) % billboards.length
        ),
      8_000
    )
    return () => window.clearInterval(interval)
  }, [billboards.length, isPaused, prefersReducedMotion])

  useEffect(() => {
    setActiveIndex((currentIndex) =>
      Math.min(currentIndex, Math.max(billboards.length - 1, 0))
    )
  }, [billboards.length])

  function showBillboard(index: number) {
    setActiveIndex((index + billboards.length) % Math.max(billboards.length, 1))
  }

  if (!billboard) return null

  return (
    <section
      aria-label={`Featured ${billboard.item.type}`}
      className="group relative isolate min-h-[70svh] overflow-hidden bg-hero text-hero-foreground"
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          setIsPaused(false)
      }}
      onFocusCapture={() => setIsPaused(true)}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {billboards.map((candidate, index) => (
        <img
          alt=""
          className={cn(
            "absolute inset-0 size-full object-cover transition-opacity duration-700 motion-reduce:transition-none",
            index === activeIndex ? "opacity-100" : "opacity-0"
          )}
          key={candidate.item.id}
          referrerPolicy="no-referrer"
          src={candidate.item.backdropImageUrl}
        />
      ))}
      <div className="absolute inset-0 bg-linear-to-r from-hero to-transparent" />
      <div className="relative flex min-h-[70svh] items-end px-6 py-12 sm:items-center sm:px-10">
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
                variant="default"
              />
            )}
            {signedIn && (
              <SystemListToggle
                className="border-hero-foreground/60 text-hero-foreground hover:bg-hero-foreground/10 hover:text-hero-foreground"
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
                aria-pressed={index === activeIndex}
                className={cn(
                  "size-2 rounded-full bg-hero-foreground/40 p-0 hover:bg-hero-foreground",
                  index === activeIndex && "bg-hero-foreground"
                )}
                key={candidate.item.id}
                onClick={() => showBillboard(index)}
                size="icon-xs"
                variant="ghost"
              />
            ))}
          </div>
          <div className="pointer-events-none absolute inset-y-0 right-0 left-0">
            <div className="pointer-events-auto absolute inset-y-0 left-0 flex w-24 items-center opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
              <Button
                aria-label="Previous featured title"
                className="ml-3 bg-hero/50 text-hero-foreground hover:bg-hero/80 hover:text-hero-foreground"
                onClick={() => showBillboard(activeIndex - 1)}
                size="icon"
                variant="ghost"
              >
                <ChevronLeftIcon />
              </Button>
            </div>
            <div className="pointer-events-auto absolute inset-y-0 right-0 flex w-24 items-center justify-end opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
              <Button
                aria-label="Next featured title"
                className="mr-3 bg-hero/50 text-hero-foreground hover:bg-hero/80 hover:text-hero-foreground"
                onClick={() => showBillboard(activeIndex + 1)}
                size="icon"
                variant="ghost"
              >
                <ChevronRightIcon />
              </Button>
            </div>
          </div>
        </>
      )}
    </section>
  )
}

function formatRuntime(runtime: number) {
  const hours = Math.floor(runtime / 60)
  const minutes = runtime % 60
  if (!hours) return `${minutes}m`
  if (!minutes) return `${hours}h`
  return `${hours}h ${minutes}m`
}
