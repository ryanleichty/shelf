"use client"

import { Link } from "@tanstack/react-router"
import { PlusIcon } from "lucide-react"
import { useState } from "react"
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
  const [emptySystemListRows, setEmptySystemListRows] = useState<Set<string>>(
    () => new Set()
  )

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
            if (isSystemListRow && emptySystemListRows.has(row.slug)) return null

            return (
              <section className="overflow-x-hidden" key={row.title}>
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
                <HomeCarousel
                  id={`${type}-row-${index}`}
                  items={row.items}
                  onEmptyChange={
                    isSystemListRow
                      ? (isEmpty) =>
                          setEmptySystemListRows((current) => {
                            if (isEmpty === current.has(row.slug)) return current
                            const next = new Set(current)
                            if (isEmpty) next.add(row.slug)
                            else next.delete(row.slug)
                            return next
                          })
                      : undefined
                  }
                  systemListSlug={isSystemListRow ? systemListSlug : undefined}
                />
              </section>
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
