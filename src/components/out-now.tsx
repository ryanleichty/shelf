import { Link } from "@tanstack/react-router"
import { Badge } from "@/components/ui/badge"
import type { Item } from "@/server/schema"

export function OutNow({ items }: { items: Item[] }) {
  const out = items.filter((item) => item.status !== "owned")
  if (!out.length) return null
  return (
    <section className="out-now" aria-labelledby="out-now-heading">
      <div><p className="eyebrow">In motion</p><h2 id="out-now-heading">Currently out</h2></div>
      <div className="out-list">
        {out.map((item) => <Link key={item.id} params={{ slug: item.slug }} to="/item/$slug">
          <span>{item.title}</span>
          <small>{item.status === "borrowed" && item.borrower ? `With ${item.borrower}` : "Reading"}</small>
          <Badge className={`out-badge status-${item.status}`} variant="outline">{item.status === "reading" ? "Reading" : "Borrowed"}</Badge>
        </Link>)}
      </div>
    </section>
  )
}
