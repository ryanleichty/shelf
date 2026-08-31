"use client"

import { useEffect, useState } from "react"
import { Link } from "@tanstack/react-router"
import { Badge } from "@/components/ui/badge"
import { useSignedInStatus } from "@/components/signed-in-status"
import { SystemListToggle } from "@/components/system-list-toggle"
import { READLIST_NAME, READLIST_SLUG } from "@/lib/system-lists"
import { cn } from "@/lib/utils"
import { getItemBackdrop } from "@/server/items"
import type { Item, TileItem } from "@/server/schema"

export function CoverTile({
  item,
  className = "",
  variant = "default",
  fromAll = false,
  onSystemListMembershipChange,
}: {
  item: TileItem
  className?: string
  variant?: "default" | "carousel"
  fromAll?: boolean
  onSystemListMembershipChange?: (itemId: number, containsItem: boolean) => void
}) {
  const accessibleName = item.creator
    ? `${item.title} by ${item.creator}`
    : item.title
  const isCarouselTile = variant === "carousel"
  const { signedIn } = useSignedInStatus()
  const [isHovering, setIsHovering] = useState(false)
  const [isFocusWithin, setIsFocusWithin] = useState(false)
  const [isBackdropVisible, setIsBackdropVisible] = useState(false)
  const [backdropImageUrl, setBackdropImageUrl] = useState<string | null>()
  const [isBackdropLoading, setIsBackdropLoading] = useState(false)
  const [supportsPreview, setSupportsPreview] = useState(false)
  const shouldMountBackdrop =
    supportsPreview &&
    Boolean(backdropImageUrl) &&
    (isHovering || isFocusWithin)
  const systemList =
    item.type === "book"
      ? {
          slug: READLIST_SLUG,
          name: READLIST_NAME,
          containsItem: item.isInSystemList,
        }
      : {
          slug: "watchlist",
          name: "Watchlist",
          containsItem: item.isInSystemList,
        }

  useEffect(() => {
    const hoverMedia = window.matchMedia("(hover: hover) and (pointer: fine)")
    const motionMedia = window.matchMedia("(prefers-reduced-motion: reduce)")
    const updateSupport = () =>
      setSupportsPreview(hoverMedia.matches && !motionMedia.matches)

    updateSupport()
    hoverMedia.addEventListener("change", updateSupport)
    motionMedia.addEventListener("change", updateSupport)
    return () => {
      hoverMedia.removeEventListener("change", updateSupport)
      motionMedia.removeEventListener("change", updateSupport)
    }
  }, [])

  useEffect(() => {
    if (!shouldMountBackdrop) {
      setIsBackdropVisible(false)
      return
    }

    const frame = requestAnimationFrame(() => setIsBackdropVisible(true))
    return () => cancelAnimationFrame(frame)
  }, [shouldMountBackdrop])

  function loadBackdrop() {
    if (
      !supportsPreview ||
      item.type === "book" ||
      backdropImageUrl !== undefined ||
      isBackdropLoading
    )
      return

    setIsBackdropLoading(true)
    void getItemBackdrop({ data: { itemId: item.id } })
      .then(setBackdropImageUrl)
      .catch(() => setBackdropImageUrl(null))
      .finally(() => setIsBackdropLoading(false))
  }

  return (
    <div
      className={cn(
        "group relative",
        isCarouselTile && "z-0 focus-within:z-10 hover:z-10",
        className
      )}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setIsFocusWithin(false)
        }
      }}
      onFocus={() => {
        setIsFocusWithin(true)
        loadBackdrop()
      }}
      onPointerEnter={() => {
        setIsHovering(true)
        loadBackdrop()
      }}
      onPointerLeave={() => setIsHovering(false)}
    >
      <Link
        aria-label={accessibleName}
        className="block focus-visible:outline-none"
        params={{ slug: item.slug }}
        search={fromAll ? { from: "all" } : {}}
        to="/item/$slug"
      >
        <div className="relative aspect-2/3 overflow-hidden rounded-lg bg-muted transition-[scale] duration-200 ease-out group-focus-within:scale-105 group-hover:scale-105 after:absolute after:inset-0 after:rounded-[inherit] after:border after:border-black/10 motion-reduce:transition-none motion-reduce:group-focus-within:scale-100 motion-reduce:group-hover:scale-100">
          {item.coverImageUrl ? (
            <img
              alt={item.title}
              className="h-full w-full object-cover"
              referrerPolicy="no-referrer"
              src={item.coverImageUrl}
            />
          ) : (
            <div
              aria-hidden="true"
              className="flex h-full items-center justify-center bg-muted text-2xl font-semibold text-muted-foreground/50"
            >
              S
            </div>
          )}
          {shouldMountBackdrop && (
            <img
              alt=""
              aria-hidden="true"
              className={cn(
                "pointer-events-none absolute inset-0 h-full w-full rounded-[inherit] object-cover transition-opacity duration-200 ease-out",
                isBackdropVisible ? "opacity-100" : "opacity-0"
              )}
              referrerPolicy="no-referrer"
              src={backdropImageUrl}
            />
          )}
          {item.edition && (
            <Badge
              className="absolute top-2 left-2 bg-background/90 text-[0.625rem]"
              variant="outline"
            >
              {editionLabel(item.edition)}
            </Badge>
          )}
          {item.status !== "owned" && (
            <Badge
              className="absolute right-2 bottom-2 bg-background/90"
              variant="outline"
            >
              {statusLabel(item.status)}
            </Badge>
          )}
        </div>
      </Link>
      {signedIn && (
        <SystemListToggle
          className="pointer-events-none absolute top-2 right-2 origin-top-right border-transparent bg-background/90 opacity-0 ring-1 ring-black/10 transition-[opacity,scale] group-focus-within:pointer-events-auto group-focus-within:scale-105 group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:scale-105 group-hover:opacity-100 focus-visible:pointer-events-auto focus-visible:opacity-100 motion-reduce:transition-none motion-reduce:group-focus-within:scale-100 motion-reduce:group-hover:scale-100"
          itemId={item.id}
          list={systemList}
          onMembershipChange={(containsItem) =>
            onSystemListMembershipChange?.(item.id, containsItem)
          }
        />
      )}
    </div>
  )
}

function statusLabel(status: Exclude<Item["status"], "owned">) {
  return status === "reading"
    ? "Reading"
    : status === "watching"
      ? "Watching"
      : "Borrowed"
}

function editionLabel(edition: string) {
  return edition === "director-cut"
    ? "Director's Cut"
    : edition[0].toUpperCase() + edition.slice(1)
}
