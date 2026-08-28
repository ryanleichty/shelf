import { Link } from "@tanstack/react-router"
import { Search } from "lucide-react"
import { useMemo, useState } from "react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
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
      <div className="catalog-controls">
        <div className="filter-list" aria-label="Collection filters">
          {filters.map((filter) => (
            <button
              className={type === filter.value ? "filter-active" : ""}
              key={filter.value}
              onClick={() => setType(filter.value)}
              type="button"
            >
              {filter.label}
            </button>
          ))}
        </div>
        <label className="search-field">
          <Search aria-hidden="true" size={15} />
          <span className="sr-only">Search the collection</span>
          <Input onChange={(event) => setQuery(event.target.value)} placeholder="Search the shelf" value={query} />
        </label>
      </div>

      {visibleItems.length ? (
        <div className="shelf-grid">
          {visibleItems.map((item) => (
            <Link className="shelf-item" key={item.id} params={{ slug: item.slug }} to="/item/$slug">
              <div className={`cover ${item.type}`}>
                {item.coverImageUrl ? (
                  <img alt={item.title} referrerPolicy="no-referrer" src={item.coverImageUrl} />
                ) : (
                  <div className="cover-type">
                    <span>{item.type}</span>
                    <span>{item.year}</span>
                  </div>
                )}
                {item.status !== "owned" && <Badge className={`status-badge status-${item.status}`} variant="outline">{statusLabel(item.status)}</Badge>}
              </div>
              <div className="item-copy">
                <h2>{item.title}</h2>
                <p>{item.creator}</p>
                {item.status === "borrowed" && item.borrower && <p className="loan-note">With {item.borrower}{item.loanedAt ? ` · out ${new Date(`${item.loanedAt}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}</p>}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="empty-shelf">
          <p>Nothing found here.</p>
          <span>Try a different title, creator, or shelf.</span>
        </div>
      )}
    </>
  )
}

function statusLabel(status: Exclude<Item["status"], "owned">) {
  return status === "reading" ? "Reading" : "Borrowed"
}
