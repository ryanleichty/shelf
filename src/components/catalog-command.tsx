"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "@tanstack/react-router"
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { getItems, getSearchFacets } from "@/server/items"
import type { SearchFacets } from "@/server/items"
import type { Item } from "@/server/schema"

type SearchFacet = { name: string; slug: string }
const emptySearchFacets: SearchFacets = {
  genres: [],
  directors: [],
  actors: [],
  authors: [],
}

function CatalogCommandItem({
  item,
  onSelect,
}: {
  item: Item
  onSelect: () => void
}) {
  const genre = item.genres[0]

  return (
    <CommandItem onSelect={onSelect} value={item.title}>
      {item.coverImageUrl ? (
        <img
          alt=""
          className="aspect-[2/3] h-10 shrink-0 rounded-sm object-cover"
          src={item.coverImageUrl}
        />
      ) : (
        <span
          aria-hidden
          className="aspect-[2/3] h-10 shrink-0 rounded-sm bg-muted"
        />
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate">{item.title}</span>
        {genre && (
          <span className="block truncate text-xs text-muted-foreground">
            {genre}
          </span>
        )}
      </span>
      <span className="shrink-0 text-right text-xs text-muted-foreground">
        {item.creator}
      </span>
    </CommandItem>
  )
}

function CatalogFacetCommandItem({
  facet,
  kind,
  onSelect,
}: {
  facet: SearchFacet
  kind: "Genre" | "Director" | "Actor" | "Author"
  onSelect: () => void
}) {
  return (
    <CommandItem onSelect={onSelect} value={facet.name}>
      <span className="min-w-0 flex-1 truncate">{facet.name}</span>
      <span className="shrink-0 text-right text-xs text-muted-foreground">
        {kind}
      </span>
    </CommandItem>
  )
}

export function CatalogCommand({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [items, setItems] = useState<Item[]>([])
  const [facets, setFacets] = useState<SearchFacets>(emptySearchFacets)

  useEffect(() => {
    let active = true
    const timer = window.setTimeout(() => {
      const normalizedQuery = query.trim()
      const itemSearch = getItems({
        data: normalizedQuery ? { query: normalizedQuery } : {},
      }).catch(() => [])
      const facetSearch = normalizedQuery
        ? getSearchFacets({ data: { query: normalizedQuery } }).catch(
            () => emptySearchFacets
          )
        : Promise.resolve(emptySearchFacets)

      Promise.all([itemSearch, facetSearch]).then(([nextItems, nextFacets]) => {
        if (!active) return
        setItems(nextItems)
        setFacets(nextFacets)
      })
    }, 150)
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [query])
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        onOpenChange(true)
      }
    }
    window.addEventListener("keydown", keydown)
    return () => window.removeEventListener("keydown", keydown)
  }, [onOpenChange])

  const books = useMemo(
    () => items.filter((item) => item.type === "book"),
    [items]
  )
  const movies = useMemo(
    () => items.filter((item) => item.type === "movie"),
    [items]
  )
  const tv = useMemo(() => items.filter((item) => item.type === "tv"), [items])
  const select = (item: Item) => {
    onOpenChange(false)
    router.navigate({ to: "/item/$slug", params: { slug: item.slug } })
  }
  const selectFacet = (
    kind: "genre" | "director" | "actor" | "author",
    slug: string
  ) => {
    onOpenChange(false)
    if (kind === "genre")
      router.navigate({ to: "/genre/$slug", params: { slug } })
    else if (kind === "director")
      router.navigate({ to: "/director/$slug", params: { slug } })
    else if (kind === "actor")
      router.navigate({ to: "/actor/$slug", params: { slug } })
    else router.navigate({ to: "/author/$slug", params: { slug } })
  }
  return (
    <CommandDialog
      className="sm:max-w-xl"
      onOpenChange={onOpenChange}
      open={open}
      title="Search Shelf"
    >
      <Command shouldFilter={false}>
        <CommandInput
          onValueChange={setQuery}
          placeholder="Search Shelf…"
          value={query}
        />
        <CommandList className="max-h-96">
          <CommandEmpty>No results found.</CommandEmpty>
          {books.length > 0 && (
            <CommandGroup heading="Books">
              {books.map((item) => (
                <CatalogCommandItem
                  item={item}
                  key={item.id}
                  onSelect={() => select(item)}
                />
              ))}
            </CommandGroup>
          )}
          {movies.length > 0 && (
            <CommandGroup heading="Movies">
              {movies.map((item) => (
                <CatalogCommandItem
                  item={item}
                  key={item.id}
                  onSelect={() => select(item)}
                />
              ))}
            </CommandGroup>
          )}
          {tv.length > 0 && (
            <CommandGroup heading="TV">
              {tv.map((item) => (
                <CatalogCommandItem
                  item={item}
                  key={item.id}
                  onSelect={() => select(item)}
                />
              ))}
            </CommandGroup>
          )}
          {facets.genres.length > 0 && (
            <CommandGroup heading="Genres">
              {facets.genres.map((facet) => (
                <CatalogFacetCommandItem
                  facet={facet}
                  kind="Genre"
                  key={facet.slug}
                  onSelect={() => selectFacet("genre", facet.slug)}
                />
              ))}
            </CommandGroup>
          )}
          {facets.directors.length > 0 && (
            <CommandGroup heading="Directors">
              {facets.directors.map((facet) => (
                <CatalogFacetCommandItem
                  facet={facet}
                  kind="Director"
                  key={facet.slug}
                  onSelect={() => selectFacet("director", facet.slug)}
                />
              ))}
            </CommandGroup>
          )}
          {facets.actors.length > 0 && (
            <CommandGroup heading="Actors">
              {facets.actors.map((facet) => (
                <CatalogFacetCommandItem
                  facet={facet}
                  kind="Actor"
                  key={facet.slug}
                  onSelect={() => selectFacet("actor", facet.slug)}
                />
              ))}
            </CommandGroup>
          )}
          {facets.authors.length > 0 && (
            <CommandGroup heading="Authors">
              {facets.authors.map((facet) => (
                <CatalogFacetCommandItem
                  facet={facet}
                  kind="Author"
                  key={facet.slug}
                  onSelect={() => selectFacet("author", facet.slug)}
                />
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </Command>
    </CommandDialog>
  )
}
