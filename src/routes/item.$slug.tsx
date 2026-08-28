import { Link, createFileRoute, notFound } from "@tanstack/react-router"
import { ArrowLeft } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { getItemBySlug } from "@/server/items"

export const Route = createFileRoute("/item/$slug")({
  loader: async ({ params }) => {
    const item = await getItemBySlug({ data: { slug: params.slug } })
    if (!item) throw notFound()
    return item
  },
  component: ItemDetail,
})

function ItemDetail() {
  const item = Route.useLoaderData()
  return (
    <main className="page detail-page">
      <Link className="back-link" to={item.type === "book" ? "/books" : "/movies"}>
        <ArrowLeft aria-hidden="true" size={15} /> Back to {item.type === "book" ? "books" : "movies"}
      </Link>
      <article className="item-detail">
        <div className={`detail-cover cover ${item.type}`}>
          {item.coverImageUrl ? <img alt={item.title} referrerPolicy="no-referrer" src={item.coverImageUrl} /> : <span>{item.type}</span>}
        </div>
        <div className="detail-copy">
          <div className="detail-meta"><p className="eyebrow">{item.type} · {item.year}</p>{item.status !== "owned" && <Badge className={`status-badge status-${item.status}`} variant="outline">{item.status === "reading" ? "Reading" : "Borrowed"}</Badge>}</div>
          <h1>{item.title}</h1>
          <p className="creator">{item.creator}</p>
          {item.notes && <p className="notes">{item.notes}</p>}
          {item.acquiredAt && <p className="acquired">On the shelf since {new Date(`${item.acquiredAt}T12:00:00`).toLocaleDateString("en-US", { month: "long", year: "numeric" })}</p>}
        </div>
      </article>
    </main>
  )
}
