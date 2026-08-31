"use client"

import { Link } from "@tanstack/react-router"
import { PlusIcon } from "lucide-react"
import { Catalog } from "@/components/catalog"
import { OutNow } from "@/components/out-now"
import { Button } from "@/components/ui/button"
import type { Item, TileItem } from "@/server/schema"

export function AllCatalog({
  addLabel,
  items,
  subtitle,
  title,
  type,
  query,
  onQueryChange,
}: {
  addLabel: string
  items: TileItem[]
  subtitle: string
  title: string
  type: Item["type"]
  query?: string
  onQueryChange: (query: string) => void
}) {
  return (
    <main className="container mx-auto max-w-6xl px-4 py-10">
      <section className="mb-8 flex items-end justify-between gap-4">
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
      <OutNow fromAll items={items} />
      <Catalog
        fromAll
        items={items}
        onQueryChange={onQueryChange}
        query={query}
        type={type}
      />
    </main>
  )
}
