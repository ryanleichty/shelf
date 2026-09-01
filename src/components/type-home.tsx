"use client"

import { Link } from "@tanstack/react-router"
import { PlusIcon } from "lucide-react"
import type { ReactNode } from "react"
import { HomeCarousel } from "@/components/home-carousel"
import { useSignedInStatus } from "@/components/signed-in-status"
import { SystemListToggle } from "@/components/system-list-toggle"
import { Button } from "@/components/ui/button"
import { coverPlateBackground } from "@/lib/cover-plate"
import { READLIST_NAME, READLIST_SLUG } from "@/lib/system-lists"
import { cn } from "@/lib/utils"
import type { Item } from "@/server/schema"

type HomeRow =
  | { title: string; kind: "recent"; items: Item[] }
  | {
      title: string
      kind: "list" | "genre" | "collection" | "director" | "actor" | "author"
      slug: string
      items: Item[]
    }

export function TypeHome({
  addLabel,
  subtitle,
  title,
  type,
  rows,
}: {
  addLabel: string
  subtitle: string
  title: string
  type: Item["type"]
  rows: HomeRow[]
}) {
  const systemListSlug = type === "book" ? "reading-list" : "watchlist"

  return (
    <main className="overflow-x-hidden py-10">
      <section className="container mx-auto mb-10 flex max-w-6xl items-end justify-between gap-4 px-4">
        <div>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            {title}
          </h1>
        </div>
        <Button render={<Link search={{ type }} to="/admin/new" />}>
          <PlusIcon />
          {addLabel}
        </Button>
      </section>
      {rows.length ? (
        <div className="flex flex-col gap-10">
          {rows.map((row, index) => {
            const isSystemListRow =
              row.kind === "list" && row.slug === systemListSlug

            function renderHeading() {
              return (
                <div className="container mx-auto mb-4 max-w-6xl px-4">
                  <h2 className="text-xl font-semibold tracking-tight">
                    {row.kind !== "recent" ? (
                      <Link
                        className="hover:underline"
                        params={{ slug: row.slug }}
                        to={
                          row.kind === "genre"
                            ? "/genre/$slug"
                            : row.kind === "collection"
                              ? "/collection/$slug"
                              : row.kind === "director"
                                ? "/director/$slug"
                                : row.kind === "actor"
                                  ? "/actor/$slug"
                                  : row.kind === "author"
                                    ? "/author/$slug"
                                    : type === "book"
                                      ? "/books/list/$slug"
                                      : type === "movie"
                                        ? "/movies/list/$slug"
                                        : "/tv/list/$slug"
                        }
                      >
                        {row.title}
                      </Link>
                    ) : (
                      row.title
                    )}
                  </h2>
                </div>
              )
            }

            function renderSection(content: ReactNode) {
              return (
                <section className="overflow-x-hidden">
                  {renderHeading()}
                  {content}
                </section>
              )
            }

            return (
              <HomeCarousel
                id={`${type}-row-${index}`}
                items={row.items}
                key={row.title}
                renderItem={
                  isSystemListRow
                    ? (item, onSystemListMembershipChange) => (
                        <SystemListTile
                          item={item}
                          onSystemListMembershipChange={
                            onSystemListMembershipChange
                          }
                        />
                      )
                    : undefined
                }
                renderSection={renderSection}
                slideClassName={isSystemListRow ? "w-48 sm:w-72" : undefined}
                systemListSlug={isSystemListRow ? systemListSlug : undefined}
              />
            )
          })}
        </div>
      ) : (
        <div className="container mx-auto max-w-6xl px-4">
          <div className="rounded-lg border border-dashed p-12 text-center">
            <p className="font-medium">The shelf is empty.</p>
          </div>
        </div>
      )}
    </main>
  )
}

function SystemListTile({
  item,
  onSystemListMembershipChange,
}: {
  item: Item
  onSystemListMembershipChange?: (itemId: number, containsItem: boolean) => void
}) {
  const { signedIn } = useSignedInStatus()
  const imageUrl =
    item.type === "book"
      ? item.coverImageUrl
      : (item.backdropImageUrl ?? item.coverImageUrl)
  const detail =
    item.type === "book"
      ? validPageCount(item.pageCount)
        ? `${item.pageCount} pages`
        : null
      : validRuntime(item.runtime)
        ? formatRuntime(item.runtime)
        : null
  const metadata = [
    item.type === "book" ? null : item.certification,
    item.year,
    item.genres.join(", "),
  ]
    .filter(Boolean)
    .join(" · ")
  const systemList =
    item.type === "book"
      ? {
          slug: READLIST_SLUG,
          name: READLIST_NAME,
          containsItem: item.isInSystemList,
        }
      : {
          slug: "watchlist",
          name: "Watchlist",
          containsItem: item.isInSystemList,
        }

  return (
    <div className="group relative">
      <Link
        aria-label={
          item.creator ? `${item.title} by ${item.creator}` : item.title
        }
        className="block focus-visible:outline-none"
        params={{ slug: item.slug }}
        to="/item/$slug"
      >
        <div
          className={cn(
            "relative overflow-hidden rounded-lg bg-muted transition-[scale] duration-200 ease-out group-focus-within:scale-105 group-hover:scale-105 after:absolute after:inset-0 after:rounded-[inherit] after:border after:border-black/10 motion-reduce:transition-none motion-reduce:group-focus-within:scale-100 motion-reduce:group-hover:scale-100",
            item.type === "book" ? "aspect-2/3" : "aspect-video"
          )}
        >
          {imageUrl ? (
            <img
              alt={item.title}
              className="h-full w-full object-cover"
              referrerPolicy="no-referrer"
              src={imageUrl}
            />
          ) : (
            <div
              aria-hidden="true"
              className="flex h-full items-center justify-center bg-muted"
              style={{ backgroundColor: coverPlateBackground(item.slug) }}
            >
              <span className="line-clamp-4 px-2 text-center text-sm font-medium tracking-tight text-foreground">
                {item.title}
              </span>
            </div>
          )}
        </div>
        <div className="mt-2 flex flex-col gap-0.5">
          {detail && <p className="text-sm text-muted-foreground">{detail}</p>}
          <p className="line-clamp-1 font-medium">{item.title}</p>
          {metadata && (
            <p className="line-clamp-1 text-sm text-muted-foreground">
              {metadata}
            </p>
          )}
        </div>
      </Link>
      {signedIn && (
        <SystemListToggle
          className="pointer-events-none absolute top-2 right-2 origin-top-right border-transparent bg-background/90 opacity-0 ring-1 ring-black/10 transition-[opacity,scale] group-focus-within:pointer-events-auto group-focus-within:scale-105 group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:scale-105 group-hover:opacity-100 focus-visible:pointer-events-auto focus-visible:opacity-100 motion-reduce:transition-none motion-reduce:group-focus-within:scale-100 motion-reduce:group-hover:scale-100"
          itemId={item.id}
          list={systemList}
          onMembershipChange={(containsItem) =>
            onSystemListMembershipChange?.(item.id, containsItem)
          }
        />
      )}
    </div>
  )
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

function formatRuntime(runtime: number) {
  const hours = Math.floor(runtime / 60)
  const minutes = runtime % 60
  return hours ? `${hours}h ${minutes}m` : `${minutes}m`
}
