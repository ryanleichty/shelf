import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { CoverTile } from "@/components/cover-tile"
import type { Item } from "@/server/schema"

export function Catalog({
  items,
  type,
  query,
  onQueryChange,
}: {
  items: Item[]
  type: Item["type"]
  query?: string
  onQueryChange?: (query: string) => void
}) {
  const visibleItems = items.filter((item) => item.type === type)

  return (
    <>
      <div className="mb-6 flex justify-end">
        <label className="relative w-full sm:w-64">
          <Search
            aria-hidden="true"
            className="absolute top-2.5 left-2.5 text-muted-foreground"
            size={15}
          />
          <span className="sr-only">Search the collection</span>
          <Input
            className="pl-8"
            onChange={(event) => onQueryChange?.(event.target.value)}
            placeholder="Search the shelf"
            value={query ?? ""}
          />
        </label>
      </div>

      {visibleItems.length ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {visibleItems.map((item) => (
            <CoverTile item={item} key={item.id} />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="font-medium">Nothing found.</p>
          <span className="mt-1 block text-sm text-muted-foreground">
            Try a different title, creator, or filter.
          </span>
        </div>
      )}
    </>
  )
}
