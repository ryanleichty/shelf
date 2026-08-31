"use client"

import { Catalog } from "@/components/catalog"
import { ListCoverCollage } from "@/components/list-cover-collage"
import type { Item } from "@/server/schema"

export function ListCatalog({
  items,
  name,
  query,
  onQueryChange,
  type,
}: {
  items: Item[]
  name: string
  query?: string
  onQueryChange: (query: string) => void
  type: Item["type"]
}) {
  return (
    <main className="container mx-auto max-w-6xl px-4 py-10">
      <article className="mt-8 grid gap-8 md:grid-cols-[minmax(220px,320px)_1fr]">
        <ListCoverCollage items={items} />
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{name}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {items.length} {items.length === 1 ? "title" : "titles"}
          </p>
        </div>
      </article>
      <div className="mt-8">
        <Catalog
          items={items}
          onQueryChange={onQueryChange}
          query={query}
          rememberQuery={false}
          type={type}
        />
      </div>
    </main>
  )
}
