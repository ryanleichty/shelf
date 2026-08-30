import { Link, createFileRoute, notFound } from "@tanstack/react-router"
import { ArrowLeft, BookOpenIcon } from "lucide-react"
import { useEffect, useState } from "react"
import { z } from "zod"
import { getLastCatalogQuery } from "@/components/catalog-search"
import { Badge } from "@/components/ui/badge"
import { BluRayIcon, DvdIcon } from "@/components/format-icons"
import { ItemAdminActions } from "@/components/item-admin-actions"
import { ItemListMenu } from "@/components/item-list-menu"
import { getItemBySlug } from "@/server/items"

export const Route = createFileRoute("/item/$slug")({
  validateSearch: z.object({ from: z.literal("all").optional() }),
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
  const search = Route.useSearch()
  const [lastCatalogQuery, setLastCatalogQuery] = useState<string>()

  useEffect(() => {
    setLastCatalogQuery(getLastCatalogQuery(item.type))
  }, [item.type])

  return (
    <main className="container mx-auto max-w-5xl px-4 py-10">
      <div className="flex items-start justify-between gap-4">
        <Link
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          search={{ query: lastCatalogQuery }}
          to={
            search.from === "all"
              ? item.type === "book"
                ? "/books/all"
                : item.type === "tv"
                  ? "/tv/all"
                  : "/movies/all"
              : item.type === "book"
                ? "/books"
                : item.type === "tv"
                  ? "/tv"
                  : "/movies"
          }
        >
          <ArrowLeft aria-hidden="true" size={15} /> Back to{" "}
          {item.type === "book"
            ? "books"
            : item.type === "tv"
              ? "TV"
              : "movies"}
        </Link>
        <ItemAdminActions
          id={item.id}
          providerId={item.type === "book" ? item.openLibraryKey : item.tmdbId}
          title={item.title}
          type={item.type}
        />
      </div>
      {item.type !== "book" && item.backdropImageUrl && (
        <div className="mt-8 aspect-[21/9] overflow-hidden rounded-lg bg-muted">
          <img
            alt=""
            className="h-full w-full object-cover"
            referrerPolicy="no-referrer"
            src={item.backdropImageUrl}
          />
        </div>
      )}
      <article className="mt-8 grid gap-8 md:grid-cols-[minmax(220px,320px)_1fr]">
        <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-muted">
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
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-[inherit] border"
          />
        </div>
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>
              {item.type} · <ItemYearLink type={item.type} year={item.year} />
            </span>
            {item.type !== "book" && item.certification?.trim() && (
              <Badge variant="outline">{item.certification.trim()}</Badge>
            )}
            {item.type !== "book" && validRuntime(item.runtime) && (
              <span>{formatRuntime(item.runtime)}</span>
            )}
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
          <p className="mt-2 text-lg text-muted-foreground">
            {(item.type === "book" ? item.authors : item.directors).length
              ? (item.type === "book" ? item.authors : item.directors).map(
                  (person, index) => (
                    <span key={person}>
                      {index > 0 && ", "}
                      <Link
                        params={{ slug: slugify(person) }}
                        to={
                          item.type === "book"
                            ? "/author/$slug"
                            : "/director/$slug"
                        }
                      >
                        {person}
                      </Link>
                    </span>
                  )
                )
              : item.creator}
          </p>
          {item.type !== "book" && item.actors.length > 0 && (
            <p className="mt-1 text-lg text-muted-foreground">
              {item.actors.slice(0, 8).map((person, index) => (
                <span key={person}>
                  {index > 0 && ", "}
                  <Link params={{ slug: slugify(person) }} to="/actor/$slug">
                    {person}
                  </Link>
                </span>
              ))}
            </p>
          )}
          <ItemListMenu
            itemId={item.id}
            itemType={item.type}
            lists={item.customLists}
          />
          {item.genres.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {item.genres.map((genre) => (
                <Badge
                  key={genre}
                  render={
                    <Link params={{ slug: slugify(genre) }} to="/genre/$slug" />
                  }
                  variant="secondary"
                >
                  {genre}
                </Badge>
              ))}
            </div>
          )}
          {item.type === "movie" && item.collection && (
            <div className="mt-4">
              <Badge
                render={
                  <Link
                    params={{ slug: item.collection.slug }}
                    to="/collection/$slug"
                  />
                }
                variant="secondary"
              >
                {item.collection.name}
              </Badge>
            </div>
          )}
          {item.description && (
            <p className="mt-6 max-w-prose leading-7 text-muted-foreground">
              {item.description}
            </p>
          )}
          {item.keywords.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {item.keywords.map((keyword) => (
                <Badge
                  key={keyword}
                  render={
                    <Link
                      params={{ slug: slugify(keyword) }}
                      to="/keyword/$slug"
                    />
                  }
                  variant="secondary"
                >
                  {titleCase(keyword)}
                </Badge>
              ))}
            </div>
          )}
          <div className="mt-6 space-y-2 text-sm text-muted-foreground">
            {(item.format || item.edition) && (
              <p className="flex items-center gap-2">
                {item.format && (
                  <>
                    <FormatIcon format={item.format} />
                    <span>{formatLabel(item.format)}</span>
                  </>
                )}
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

function validRuntime(runtime: number | null): runtime is number {
  return typeof runtime === "number" && Number.isInteger(runtime) && runtime > 0
}

function formatRuntime(runtime: number) {
  const hours = Math.floor(runtime / 60)
  const minutes = runtime % 60
  return hours ? `${hours}h ${minutes}m` : `${minutes}m`
}

function editionLabel(edition: string) {
  return edition === "director-cut"
    ? "Director's Cut"
    : edition[0].toUpperCase() + edition.slice(1)
}

function titleCase(value: string) {
  return value.replace(/\b\p{L}/gu, (letter) => letter.toUpperCase())
}

function FormatIcon({ format }: { format: string }) {
  if (format === "blu-ray") return <BluRayIcon />
  if (format === "dvd") return <DvdIcon />
  return <BookOpenIcon aria-hidden="true" className="size-4 shrink-0" />
}

function ItemYearLink({
  type,
  year,
}: {
  type: "book" | "movie" | "tv"
  year: number
}) {
  const yearParam = String(year).padStart(4, "0")
  const className = "underline-offset-4 hover:text-foreground hover:underline"

  if (type === "movie")
    return (
      <Link
        className={className}
        params={{ year: yearParam }}
        to="/movies/year/$year"
      >
        {year}
      </Link>
    )
  if (type === "tv")
    return (
      <Link
        className={className}
        params={{ year: yearParam }}
        to="/tv/year/$year"
      >
        {year}
      </Link>
    )
  return (
    <Link
      className={className}
      params={{ year: yearParam }}
      to="/books/year/$year"
    >
      {year}
    </Link>
  )
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}
