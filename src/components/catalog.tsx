import { Link } from "@tanstack/react-router"
import { Search } from "lucide-react"
import { useMemo, useState } from "react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import type { Item } from "@/server/schema"

const filters = [
  { label: "All", value: "all" },
  { label: "Books", value: "book" },
  { label: "Movies", value: "movie" },
] as const

export function Catalog({ items, initialType = "all" }: { items: Item[]; initialType?: "all" | Item["type"] }) {
  const [type, setType] = useState<"all" | Item["type"]>(initialType)
  const [query, setQuery] = useState("")
  const visibleItems = useMemo(
    () =>
      items.filter(
        (item) =>
          (type === "all" || item.type === type) &&
          `${item.title} ${item.creator}`.toLowerCase().includes(query.toLowerCase()),
      ),
    [items, query, type],
  )

  return (
    <>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1" aria-label="Collection filters">
          {filters.map((filter) => <Button key={filter.value} onClick={() => setType(filter.value)} size="sm" type="button" variant={type === filter.value ? "secondary" : "ghost"}>{filter.label}</Button>)}
        </div>
        <label className="relative w-full sm:w-64">
          <Search aria-hidden="true" className="absolute top-2.5 left-2.5 text-muted-foreground" size={15} />
          <span className="sr-only">Search the collection</span>
          <Input className="pl-8" onChange={(event) => setQuery(event.target.value)} placeholder="Search the shelf" value={query} />
        </label>
      </div>

      {visibleItems.length ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {visibleItems.map((item) => (
            <Link className="group" key={item.id} params={{ slug: item.slug }} to="/item/$slug">
              <Card className="overflow-hidden py-0 transition-colors group-hover:border-foreground/30">
              <div className="relative aspect-[2/3] bg-muted">
                {item.coverImageUrl ? (
                  <img alt={item.title} className="h-full w-full object-cover" referrerPolicy="no-referrer" src={item.coverImageUrl} />
                ) : (
                  <div className="flex h-full flex-col justify-between p-4 text-sm text-muted-foreground">
                    <span>{item.type}</span><span>{item.year}</span>
                  </div>
                )}
                {item.status !== "owned" && <Badge className="absolute right-2 bottom-2 bg-background/90" variant="outline">{statusLabel(item.status)}</Badge>}
              </div>
              <CardContent className="p-3"><h2 className="line-clamp-2 text-sm font-medium">{item.title}</h2><p className="mt-1 text-xs text-muted-foreground">{item.creator}</p>{item.status === "borrowed" && item.borrower && <p className="mt-2 text-xs text-muted-foreground">With {item.borrower}</p>}</CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="font-medium">Nothing found.</p><span className="mt-1 block text-sm text-muted-foreground">Try a different title, creator, or filter.</span>
        </div>
      )}
    </>
  )
}

function statusLabel(status: Exclude<Item["status"], "owned">) {
  return status === "reading" ? "Reading" : "Borrowed"
}
