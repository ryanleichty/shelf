import { Link } from "@tanstack/react-router"
import { Badge } from "@/components/ui/badge"
import type { Item } from "@/server/schema"

export function CoverTile({
  item,
  className = "",
}: {
  item: Item
  className?: string
}) {
  const accessibleName = item.creator
    ? `${item.title} by ${item.creator}`
    : item.title

  return (
    <Link
      aria-label={accessibleName}
      className={`group block ${className}`}
      params={{ slug: item.slug }}
      to="/item/$slug"
    >
      <div className="relative aspect-[2/3] overflow-hidden rounded-lg border bg-muted shadow-sm transition-[border-color,transform] group-hover:-translate-y-0.5 group-hover:border-foreground/30">
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
