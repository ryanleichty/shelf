import { Link } from "@tanstack/react-router"
import { Badge } from "@/components/ui/badge"
import type { Item } from "@/server/schema"

export function CoverTile({
  item,
  className = "",
  variant = "default",
  fromAll = false,
}: {
  item: Item
  className?: string
  variant?: "default" | "carousel"
  fromAll?: boolean
}) {
  const accessibleName = item.creator
    ? `${item.title} by ${item.creator}`
    : item.title
  const isCarouselTile = variant === "carousel"

  return (
    <Link
      aria-label={accessibleName}
      className={`group block ${isCarouselTile ? "relative z-0 hover:z-10 focus-visible:z-10 focus-visible:outline-none" : ""} ${className}`}
      params={{ slug: item.slug }}
      search={fromAll ? { from: "all" } : {}}
      to="/item/$slug"
    >
      <div
        className={`relative aspect-2/3 overflow-hidden rounded-lg bg-muted transition-[scale] duration-200 ease-out group-hover:scale-105 group-focus-visible:scale-105 after:absolute after:inset-0 after:rounded-[inherit] after:border after:border-black/10 motion-reduce:transition-none motion-reduce:group-hover:scale-100 motion-reduce:group-focus-visible:scale-100`}
      >
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
