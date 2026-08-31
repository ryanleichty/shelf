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
    <div
      aria-hidden="true"
      className="relative aspect-2/3 overflow-hidden rounded-lg bg-muted after:absolute after:inset-0 after:rounded-[inherit] after:border after:border-black/10"
    >
      {covers.length === 1 ? (
        <CoverImage item={covers[0]} />
      ) : covers.length === 3 ? (
        <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-px">
          <CoverImage className="row-span-2" item={covers[0]} />
          <CoverImage item={covers[1]} />
          <CoverImage item={covers[2]} />
        </div>
      ) : (
        <div className="absolute inset-0 grid grid-cols-2 gap-px">
          {covers.map((item) => (
            <CoverImage item={item} key={item.id} />
          ))}
        </div>
      )}
    </div>
  )
}

function CoverImage({
  className,
  item,
}: {
  className?: string
  item: ItemWithCover
}) {
  return (
    <img
      alt=""
      className={cn("h-full w-full object-cover", className)}
      referrerPolicy="no-referrer"
      src={item.coverImageUrl}
    />
  )
}
