"use client"

import { Link } from "@tanstack/react-router"
import { PlusIcon } from "lucide-react"
import { Catalog } from "@/components/catalog"
import { InProgress } from "@/components/in-progress"
import { OutNow } from "@/components/out-now"
import { Button } from "@/components/ui/button"
import { useCatalog } from "@/lib/use-catalog"
import type { CatalogItem } from "@/lib/catalog"

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
  items: CatalogItem[]
  subtitle: string
  title: string
  type: CatalogItem["type"]
  query?: string
  onQueryChange: (query: string) => void
}) {
  const { viewerStates } = useCatalog()
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
      <InProgress fromAll items={items} viewerStates={viewerStates} />
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
