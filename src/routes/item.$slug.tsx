import { Link, createFileRoute, notFound } from "@tanstack/react-router"
import { ArrowLeft } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { ItemAdminActions } from "@/components/item-admin-actions"
import { ItemListToggle } from "@/components/item-list-toggle"
import { getItemBySlug } from "@/server/items"

export const Route = createFileRoute("/item/$slug")({
  loader: async ({ params }) => {
    const item = await getItemBySlug({ data: { slug: params.slug } })
    if (!item) throw notFound()
    return item
  },
  head: ({ loaderData }) => {
    const item = loaderData
    const description = item
      ? `${item.creator}, ${item.year}. A title from Shelf.`
      : "A title from Shelf."
    return {
      meta: [
        { title: item ? `${item.title} — Shelf` : "Shelf" },
        { name: "description", content: description },
        {
          property: "og:title",
          content: item ? `${item.title} — Shelf` : "Shelf",
        },
        { property: "og:description", content: description },
        ...(item?.coverImageUrl
          ? [{ property: "og:image", content: item.coverImageUrl }]
          : []),
        {
          name: "twitter:card",
          content: item?.coverImageUrl ? "summary_large_image" : "summary",
        },
      ],
    }
  },
  component: ItemDetail,
})

function ItemDetail() {
  const item = Route.useLoaderData()
  return (
    <main className="container mx-auto max-w-5xl px-4 py-10">
      <Link
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        to={
          item.type === "book"
            ? "/books"
            : item.type === "tv"
              ? "/tv"
              : "/movies"
        }
      >
        <ArrowLeft aria-hidden="true" size={15} /> Back to{" "}
        {item.type === "book" ? "books" : item.type === "tv" ? "TV" : "movies"}
      </Link>
      <article className="mt-8 grid gap-8 md:grid-cols-[minmax(220px,320px)_1fr]">
        <div className="aspect-[2/3] overflow-hidden rounded-lg border bg-muted">
          {item.coverImageUrl ? (
            <img
              alt={item.title}
              className="h-full w-full object-cover"
              referrerPolicy="no-referrer"
              src={item.coverImageUrl}
            />
          ) : (
            <span className="flex h-full items-center justify-center text-sm text-muted-foreground">
              {item.type}
            </span>
          )}
        </div>
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>
              {item.type} · {item.year}
            </span>
            {item.status !== "owned" && (
              <Badge variant="outline">
                {item.status === "reading"
                  ? "Reading"
                  : item.status === "watching"
                    ? "Watching"
                    : "Borrowed"}
              </Badge>
            )}
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            {item.title}
          </h1>
          <p className="mt-2 text-lg text-muted-foreground">{item.creator}</p>
          <ItemListToggle
            initiallyInList={item.targetList.containsItem}
            itemId={item.id}
            listName={item.targetList.name}
            listSlug={item.targetList.slug}
          />
          <ItemAdminActions
            id={item.id}
            providerId={
              item.type === "book" ? item.openLibraryKey : item.tmdbId
            }
            title={item.title}
            type={item.type}
          />
          {item.genres.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {item.genres.map((genre) => (
                <Badge key={genre} render={<Link params={{ slug: slugify(genre) }} to="/genre/$slug" />} variant="secondary">
                  {genre}
                </Badge>
              ))}
            </div>
          )}
          {item.keywords.length > 0 && (
            <p className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
              {item.keywords.map((keyword) => (
                <Link
                  className="hover:text-foreground hover:underline"
                  key={keyword}
                  params={{ slug: slugify(keyword) }}
                  to="/keyword/$slug"
                >
                  {keyword}
                </Link>
              ))}
            </p>
          )}
          {item.description && (
            <p className="mt-6 max-w-prose leading-7 text-muted-foreground">
              {item.description}
            </p>
          )}
          <div className="mt-6 space-y-2 text-sm text-muted-foreground">
            {(item.format || item.edition) && (
              <p className="flex gap-2">
                {item.format && <span>{formatLabel(item.format)}</span>}
                {item.edition && <span>{editionLabel(item.edition)}</span>}
              </p>
            )}
            {item.status === "borrowed" && item.borrower && (
              <p>
                With {item.borrower}
                {item.loanedAt
                  ? ` · out since ${new Date(`${item.loanedAt}T12:00:00`).toLocaleDateString("en-US", { month: "long", day: "numeric" })}`
                  : ""}
              </p>
            )}
          </div>
        </div>
      </article>
    </main>
  )
}

function formatLabel(format: string) {
  return format === "blu-ray"
    ? "Blu-ray"
    : format === "dvd"
      ? "DVD"
      : format[0].toUpperCase() + format.slice(1)
}

function editionLabel(edition: string) {
  return edition === "director-cut"
    ? "Director's Cut"
    : edition[0].toUpperCase() + edition.slice(1)
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}
