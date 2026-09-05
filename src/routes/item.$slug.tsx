import {
  Link,
  createFileRoute,
  notFound,
  useRouter,
} from "@tanstack/react-router"
import { ArrowLeft, BookOpenIcon } from "lucide-react"
import { useEffect, useState } from "react"
import { z } from "zod"
import { getLastCatalogQuery } from "@/components/catalog-search"
import { HomeCarousel } from "@/components/home-carousel"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { BluRayIcon, DvdIcon } from "@/components/format-icons"
import { ItemAdminActions } from "@/components/item-admin-actions"
import { ItemLoanActions } from "@/components/item-loan-actions"
import { ItemListMenu } from "@/components/item-list-menu"
import { ItemStateToggle } from "@/components/item-state-toggle"
import { useSignedInStatus } from "@/components/signed-in-status"
import { TrailerDialog } from "@/components/trailer-dialog"
import {
  editionLabel,
  formatRuntime,
  slugify,
  statusLabel,
  typeSegments,
} from "@/lib/catalog"
import { coverPlateBackground } from "@/lib/cover-plate"
import { useCatalog } from "@/lib/use-catalog"
import { getItemPage, markItemOwned } from "@/server/items"

export const Route = createFileRoute("/item/$slug")({
  validateSearch: z.object({ from: z.literal("all").optional() }),
  loader: async ({ params }) => {
    const page = await getItemPage({ data: { slug: params.slug } })
    if (!page) throw notFound()
    return page
  },
  head: ({ loaderData }) => {
    const item = loaderData?.item
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
  const {
    item,
    similarItems,
    collectionItems,
    collectionPart,
    collectionPartCount,
    loans,
  } = Route.useLoaderData()
  const { signedIn } = useSignedInStatus()
  const { viewerStates } = useCatalog()
  const viewerState = viewerStates[item.id] ?? null
  const search = Route.useSearch()
  const router = useRouter()
  const [lastCatalogQuery, setLastCatalogQuery] = useState<string>()
  const [markingOwned, setMarkingOwned] = useState(false)
  const [markOwnedError, setMarkOwnedError] = useState("")
  const openLoan = loans.find((loan) => loan.returnedAt === null) ?? null
  const isOverdue = Boolean(
    openLoan?.dueAt && new Date(`${openLoan.dueAt}T12:00:00`) < new Date()
  )
  const pastLoans = loans.filter((loan) => loan.returnedAt !== null)

  async function markOwned() {
    setMarkingOwned(true)
    setMarkOwnedError("")
    try {
      await markItemOwned({ data: { id: item.id } })
      await router.invalidate()
    } catch (cause) {
      setMarkOwnedError(
        cause instanceof Error ? cause.message : "Could not update this item."
      )
    } finally {
      setMarkingOwned(false)
    }
  }

  useEffect(() => {
    setLastCatalogQuery(getLastCatalogQuery(item.type))
  }, [item.type])

  const wanted = item.status === "wanted"

  return (
    <main>
      {item.type !== "book" && item.backdropImageUrl && (
        <div className="aspect-[21/9] w-full overflow-hidden bg-muted sm:aspect-[3/1]">
          <img
            alt=""
            className="h-full w-full object-cover"
            referrerPolicy="no-referrer"
            src={item.backdropImageUrl}
          />
        </div>
      )}
      <div className="container mx-auto max-w-5xl px-4 py-10">
        <div className="flex items-start justify-between gap-4">
          {wanted ? (
            <Link
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
              params={{ section: typeSegments[item.type] }}
              to="/wishlist/$section"
            >
              <ArrowLeft aria-hidden="true" size={15} /> Back to wishlist
            </Link>
          ) : (
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
          )}
          <div className="flex flex-col items-end gap-2">
            <div className="flex gap-2">
              {wanted ? (
                signedIn && (
                  <Button disabled={markingOwned} onClick={markOwned}>
                    Mark as owned
                  </Button>
                )
              ) : (
                <>
                  <ItemStateToggle
                    itemId={item.id}
                    signedIn={signedIn}
                    state={viewerState}
                    type={item.type}
                  />
                  <ItemLoanActions
                    hasOpenLoan={openLoan !== null}
                    itemId={item.id}
                    signedIn={signedIn}
                  />
                </>
              )}
              <ItemAdminActions
                id={item.id}
                providerId={
                  item.type === "book" ? item.openLibraryKey : item.tmdbId
                }
                signedIn={signedIn}
                title={item.title}
                type={item.type}
              />
            </div>
            {markOwnedError && (
              <p className="text-right text-sm text-destructive" role="alert">
                {markOwnedError}
              </p>
            )}
          </div>
        </div>
        <article className="mt-8 grid gap-8 md:grid-cols-[minmax(220px,320px)_1fr]">
          <div className="relative aspect-2/3 overflow-hidden rounded-lg bg-muted after:absolute after:inset-0 after:rounded-[inherit] after:border after:border-black/10">
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
                className="flex h-full items-center justify-center"
                style={{ backgroundColor: coverPlateBackground(item.slug) }}
              >
                <span className="line-clamp-4 px-4 text-center text-lg font-medium tracking-tight">
                  {item.title}
                </span>
              </div>
            )}
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
              {item.type === "book" && validPageCount(item.pageCount) && (
                <span>{item.pageCount} pages</span>
              )}
              {item.status !== "owned" && (
                <Badge variant={wanted ? "default" : "outline"}>
                  {openLoan
                    ? `With ${openLoan.borrowerName} since ${formatLoanDate(openLoan.lentAt)}`
                    : statusLabel(item.status)}
                </Badge>
              )}
              {viewerState && (
                <Badge variant="outline">
                  {viewerState === "reading" ? "Reading" : "Watching"}
                </Badge>
              )}
              {item.status === "borrowed" && isOverdue && (
                <Badge variant="destructive">Overdue</Badge>
              )}
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              {item.title}
            </h1>
            {item.type === "book" && item.subtitle?.trim() && (
              <p className="mt-2 text-lg text-muted-foreground">
                {item.subtitle.trim()}
              </p>
            )}
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
              lists={wanted ? [] : item.customLists}
              signedIn={signedIn}
              systemList={wanted ? null : item.systemList}
              trailer={
                item.trailerKey ? (
                  <TrailerDialog
                    title={item.title}
                    trailerKey={item.trailerKey}
                  />
                ) : undefined
              }
            />
            {item.genres.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {item.genres.map((genre) => (
                  <Badge
                    key={genre}
                    render={
                      <Link
                        params={{ slug: slugify(genre) }}
                        to="/genre/$slug"
                      />
                    }
                    variant="secondary"
                  >
                    {genre}
                  </Badge>
                ))}
              </div>
            )}
            {(item.type === "movie" || item.type === "book") &&
              item.collection && (
                <div className="mt-4 flex items-baseline gap-2">
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
                  {collectionPart !== null && (
                    <span className="text-sm text-muted-foreground">
                      Part {collectionPart + 1} of {collectionPartCount}
                    </span>
                  )}
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
            <div className="mt-6 flex flex-col gap-2 text-sm text-muted-foreground">
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
              {item.type === "book" && item.publisher?.trim() && (
                <p>{item.publisher.trim()}</p>
              )}
              {item.type === "book" && item.isbn13?.trim() && (
                <p>ISBN-13: {item.isbn13.trim()}</p>
              )}
            </div>
            {signedIn && loans.length > 1 && (
              <div className="mt-6">
                <h2 className="text-sm font-medium">Loan history</h2>
                <ul className="mt-2 flex flex-col gap-1 text-sm text-muted-foreground">
                  {pastLoans.map((loan, index) => (
                    <li key={index}>
                      {loan.borrowerName}, {formatLoanDate(loan.lentAt)}
                      {" → "}
                      {loan.returnedAt ? formatLoanDate(loan.returnedAt) : ""}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </article>
      </div>
      {item.collection && collectionItems.length > 0 && (
        <section
          className="item-shelf-carousel mt-12"
          aria-labelledby="collection-parts"
        >
          <h2
            className="container mx-auto mb-4 max-w-5xl px-4 text-xl font-semibold tracking-tight"
            id="collection-parts"
          >
            <Link
              params={{ slug: item.collection.slug }}
              to="/collection/$slug"
            >
              {item.collection.name}
            </Link>
          </h2>
          <HomeCarousel
            id={`collection-parts-${item.id}`}
            items={collectionItems}
          />
        </section>
      )}
      {similarItems.length > 0 && (
        <section
          className="item-shelf-carousel mt-12"
          aria-labelledby="also-on-the-shelf"
        >
          <h2
            className="container mx-auto mb-4 max-w-5xl px-4 text-xl font-semibold tracking-tight"
            id="also-on-the-shelf"
          >
            {wanted ? "Also on the wishlist" : "Also on the shelf"}
          </h2>
          <HomeCarousel
            id={`also-on-the-shelf-${item.id}`}
            items={similarItems}
          />
        </section>
      )}
    </main>
  )
}

function formatLoanDate(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  })
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

function validPageCount(pageCount: number | null): pageCount is number {
  return (
    typeof pageCount === "number" &&
    Number.isInteger(pageCount) &&
    pageCount > 0
  )
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
