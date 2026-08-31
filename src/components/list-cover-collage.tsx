"use client"

import { cn } from "@/lib/utils"
import type { Item } from "@/server/schema"

type ItemWithCover = Item & { coverImageUrl: string }

export function ListCoverCollage({ items }: { items: Item[] }) {
  const covers = items
    .filter((item): item is ItemWithCover => Boolean(item.coverImageUrl))
    .slice(0, 4)

  if (covers.length === 0) return null

  return (
    <div className={cn(covers.length > 1 && "grid grid-cols-2 gap-1.5")}>
      {covers.map((item) => (
        <div
          className="aspect-2/3 w-20 overflow-hidden rounded-md sm:w-24"
          key={item.id}
        >
          <img
            alt={item.title}
            className="h-full w-full object-cover"
            referrerPolicy="no-referrer"
            src={item.coverImageUrl}
          />
        </div>
      ))}
    </div>
  )
}
