"use client"

import { Link } from "@tanstack/react-router"
import { PlusIcon } from "lucide-react"
import { HomeCarousel } from "@/components/home-carousel"
import { Button } from "@/components/ui/button"
import type { Item } from "@/server/schema"

type HomeRow = { title: string; slug?: string; items: Item[] }

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
          {rows.map((row, index) => (
            <section className="overflow-x-hidden" key={row.title}>
              <div className="container mx-auto mb-4 max-w-6xl px-4">
                <h2 className="text-xl font-semibold tracking-tight">
                  {row.slug ? (
                    <Link
                      className="hover:underline"
                      params={{ slug: row.slug }}
                      to="/genre/$slug"
                    >
                      {row.title}
                    </Link>
                  ) : (
                    row.title
                  )}
                </h2>
              </div>
              <HomeCarousel id={`${type}-row-${index}`} items={row.items} />
            </section>
          ))}
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
