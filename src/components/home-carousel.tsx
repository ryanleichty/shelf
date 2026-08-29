"use client"

import {
  BlossomCarousel,
  BlossomNext,
  BlossomPrev,
} from "@blossom-carousel/react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { CoverTile } from "@/components/cover-tile"
import { Button } from "@/components/ui/button"
import type { Item } from "@/server/schema"

export function HomeCarousel({
  id,
  items,
}: {
  id: string
  items: Item[]
}) {
  return (
    <div className="relative">
      <BlossomCarousel
        className="snap-x snap-mandatory pr-4"
        id={id}
      >
        {items.map((item) => (
          <div
            className="mr-3 w-28 snap-start whitespace-normal sm:w-36"
            data-blossom-slide
            key={item.id}
          >
            <CoverTile className="w-full" item={item} />
          </div>
        ))}
      </BlossomCarousel>
      <div className="home-carousel-controls absolute top-1/2 right-2 left-2 hidden -translate-y-1/2 justify-between md:flex">
        <Button
          aria-label="Previous titles"
          className="bg-background/90 shadow-sm"
          render={<BlossomPrev for={id} />}
          size="icon"
          variant="outline"
        >
          <ChevronLeft />
        </Button>
        <Button
          aria-label="Next titles"
          className="bg-background/90 shadow-sm"
          render={<BlossomNext for={id} />}
          size="icon"
          variant="outline"
        >
          <ChevronRight />
        </Button>
      </div>
    </div>
  )
}
