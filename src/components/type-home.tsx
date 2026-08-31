"use client"

import { Link } from "@tanstack/react-router"
import { PlusIcon } from "lucide-react"
import type { ReactNode } from "react"
import { CoverTile } from "@/components/cover-tile"
import { HomeCarousel } from "@/components/home-carousel"
import { Button } from "@/components/ui/button"
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
            const totalRuntime =
              isSystemListRow && type !== "book"
                ? row.items.reduce(
                    (total, item) =>
                      validRuntime(item.runtime) ? total + item.runtime : total,
                    0
                  )
                : null
            const systemListDetail = isSystemListRow
              ? type === "book"
                ? `${row.items.length} ${row.items.length === 1 ? "title" : "titles"}`
                : totalRuntime
                  ? formatRuntime(totalRuntime)
                  : null
              : null

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
                  {systemListDetail && (
                    <p className="text-sm text-muted-foreground">
                      {systemListDetail}
                    </p>
                  )}
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

            if (isSystemListRow && type === "book") {
              if (row.items.length === 0) return null

              return (
                <section className="overflow-x-hidden" key={row.title}>
                  {renderHeading()}
                  <div className="container mx-auto max-w-6xl px-4">
                    <div className="flex items-start py-2">
                      {row.items.slice(0, 6).map((item, pileIndex) => (
                        <div
                          className="-ml-12 first:ml-0 w-24 sm:w-36"
                          key={item.id}
                          style={{ zIndex: 6 - pileIndex }}
                        >
                          <CoverTile className="w-full" item={item} />
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              )
            }

            return (
              <HomeCarousel
                id={`${type}-row-${index}`}
                items={row.items}
                key={row.title}
                renderSection={renderSection}
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

function validRuntime(runtime: number | null): runtime is number {
  return typeof runtime === "number" && Number.isInteger(runtime) && runtime > 0
}

function formatRuntime(runtime: number) {
  const hours = Math.floor(runtime / 60)
  const minutes = runtime % 60
  return hours ? `${hours}h ${minutes}m` : `${minutes}m`
}
