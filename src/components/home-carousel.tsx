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
import type { CatalogItem } from "@/lib/catalog"

export function HomeCarousel({
  contained = false,
  id,
  items,
  renderCaption,
  renderSection,
  hideMissingCoverTitle = false,
  slideClassName,
  systemListSlug,
}: {
  contained?: boolean
  id: string
  items: CatalogItem[]
  renderCaption?: (item: CatalogItem) => ReactNode
  renderSection?: (carousel: ReactNode) => ReactNode
  hideMissingCoverTitle?: boolean
  slideClassName?: string
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
          "home-carousel snap-x snap-mandatory overflow-x-auto overflow-y-clip",
          contained && "home-carousel-contained"
        )}
        id={id}
      >
        {visibleItems.map((item) => (
          <div
            className={cn(
              "relative z-0 mr-3 w-28 snap-start py-4 whitespace-normal focus-within:z-10 hover:z-10 sm:w-56",
              slideClassName
            )}
            data-blossom-slide
            key={item.id}
          >
            <CoverTile
              className="w-full"
              hideMissingCoverTitle={hideMissingCoverTitle}
              item={item}
              onSystemListMembershipChange={
                systemListSlug ? handleSystemListMembershipChange : undefined
              }
              variant="carousel"
            >
              {renderCaption?.(item)}
            </CoverTile>
          </div>
        ))}
      </BlossomCarousel>
      <div
        className={cn(
          "home-carousel-controls pointer-events-none absolute inset-x-0 top-4 z-20 hidden md:block",
          slideClassName
            ? "h-[16.5rem] sm:h-[27rem]"
            : "h-[10.5rem] sm:h-[21rem]"
        )}
      >
        <div className="pointer-events-auto absolute inset-y-0 left-0 flex w-12 items-center opacity-0 transition-opacity focus-within:opacity-100 hover:opacity-100">
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
        <div className="pointer-events-auto absolute inset-y-0 right-0 flex w-12 items-center justify-end opacity-0 transition-opacity focus-within:opacity-100 hover:opacity-100">
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
