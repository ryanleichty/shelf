"use client"

import {
  BlossomCarousel,
  BlossomNext,
  BlossomPrev,
} from "@blossom-carousel/react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { type ReactNode, useState } from "react"
import { CoverTile } from "@/components/cover-tile"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { Item } from "@/server/schema"

export function HomeCarousel({
  contained = false,
  id,
  items,
  renderSection,
  systemListSlug,
}: {
  contained?: boolean
  id: string
  items: Item[]
  renderSection?: (carousel: ReactNode) => ReactNode
  systemListSlug?: string
}) {
  const [hiddenItemIds, setHiddenItemIds] = useState<Set<number>>(
    () => new Set()
  )
  const visibleItems = systemListSlug
    ? items.filter((item) => !hiddenItemIds.has(item.id))
    : items

  function handleSystemListMembershipChange(
    itemId: number,
    containsItem: boolean
  ) {
    setHiddenItemIds((currentHiddenItemIds) => {
      const nextHiddenItemIds = new Set(currentHiddenItemIds)
      if (containsItem) nextHiddenItemIds.delete(itemId)
      else nextHiddenItemIds.add(itemId)
      return nextHiddenItemIds
    })
  }

  if (systemListSlug && visibleItems.length === 0) return null

  const carousel = (
    <div className="relative">
      <BlossomCarousel
        className={cn(
          "home-carousel snap-x snap-mandatory",
          contained && "home-carousel-contained"
        )}
        id={id}
      >
        {visibleItems.map((item) => (
          <div
            className="relative z-0 mr-3 w-28 snap-start whitespace-normal focus-within:z-10 hover:z-10 sm:w-56"
            data-blossom-slide
            key={item.id}
          >
            <CoverTile
              className="w-full"
              item={item}
              onSystemListMembershipChange={
                systemListSlug ? handleSystemListMembershipChange : undefined
              }
              variant="carousel"
            />
          </div>
        ))}
      </BlossomCarousel>
      <div className="home-carousel-controls pointer-events-none absolute inset-y-0 right-0 left-0 z-20 hidden md:block">
        <div className="pointer-events-auto absolute inset-y-0 left-0 flex w-24 items-center opacity-0 transition-opacity focus-within:opacity-100 hover:opacity-100">
          <Button
            aria-label="Previous titles"
            className="ml-2 border-transparent bg-background/90 ring-1 ring-black/10"
            render={<BlossomPrev for={id} />}
            size="icon"
            variant="outline"
          >
            <ChevronLeft />
          </Button>
        </div>
        <div className="pointer-events-auto absolute inset-y-0 right-0 flex w-24 items-center justify-end opacity-0 transition-opacity focus-within:opacity-100 hover:opacity-100">
          <Button
            aria-label="Next titles"
            className="mr-2 border-transparent bg-background/90 ring-1 ring-black/10"
            render={<BlossomNext for={id} />}
            size="icon"
            variant="outline"
          >
            <ChevronRight />
          </Button>
        </div>
      </div>
    </div>
  )
  return renderSection ? renderSection(carousel) : carousel
}
