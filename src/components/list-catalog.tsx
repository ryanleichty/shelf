"use client"

import { Catalog } from "@/components/catalog"
import type { Item, TileItem } from "@/server/schema"

export function ListCatalog({
  items,
  name,
  query,
  onQueryChange,
  type,
}: {
  items: TileItem[]
  name: string
  query?: string
  onQueryChange: (query: string) => void
  type: Item["type"]
}) {
  return (
    <main className="container mx-auto max-w-6xl px-4 py-10">
      <p className="text-sm text-muted-foreground">{name}</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">{name}</h1>
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
