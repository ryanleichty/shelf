"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "@tanstack/react-router"
import { BookOpenIcon, FilmIcon, ScanLineIcon, TvIcon } from "lucide-react"
import { CheckBarcodeDialog } from "@/components/check-barcode-dialog"
import { useSignedInStatus } from "@/components/signed-in-status"
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command"
import { matchesQuery } from "@/lib/catalog"
import { useCatalog } from "@/lib/use-catalog"
import { getSearchFacets } from "@/server/items"
import type { SearchFacets } from "@/server/items"
import type { CatalogItem } from "@/lib/catalog"

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
  item: CatalogItem
  onSelect: () => void
}) {
  const genre = item.genres[0]

  return (
    <CommandItem onSelect={onSelect} value={`item:${item.id}`}>
      {item.coverImageUrl ? (
        <img
          alt=""
          className="aspect-[2/3] h-10 shrink-0 rounded-sm object-cover"
          loading="lazy"
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
  value,
}: {
  facet: SearchFacet
  kind: "Genre" | "Director" | "Actor" | "Author"
  onSelect: () => void
  value: string
}) {
  return (
    <CommandItem onSelect={onSelect} value={value}>
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
  const { signedIn } = useSignedInStatus()
  const [query, setQuery] = useState("")
  const [checkBarcodeOpen, setCheckBarcodeOpen] = useState(false)
  const catalog = useCatalog()
  const items = useMemo(
    () => catalog.items.filter((item) => matchesQuery(item, query)),
    [catalog, query]
  )
  const [facets, setFacets] = useState<SearchFacets>(emptySearchFacets)

  useEffect(() => {
    let active = true
    const timer = window.setTimeout(() => {
      const normalizedQuery = query.trim()
      const facetSearch = normalizedQuery
        ? getSearchFacets({ data: { query: normalizedQuery } }).catch(
            () => emptySearchFacets
          )
        : Promise.resolve(emptySearchFacets)
      facetSearch.then((nextFacets) => {
        if (active) setFacets(nextFacets)
      })
    }, 150)
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [query])
  const books = useMemo(
    () => items.filter((item) => item.type === "book"),
    [items]
  )
  const movies = useMemo(
    () => items.filter((item) => item.type === "movie"),
    [items]
  )
  const tv = useMemo(() => items.filter((item) => item.type === "tv"), [items])
  const select = (item: CatalogItem) => {
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
  const openCheckBarcode = () => {
    onOpenChange(false)
    setCheckBarcodeOpen(true)
  }
  const addItem = (type: "book" | "movie" | "tv") => {
    onOpenChange(false)
    router.navigate({ to: "/admin/new", search: { type } })
  }
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        onOpenChange(true)
        return
      }
      if (!open || !signedIn || (!event.metaKey && !event.ctrlKey)) return
      if (event.key === "1") {
        event.preventDefault()
        openCheckBarcode()
      } else if (event.key === "2") {
        event.preventDefault()
        addItem("book")
      } else if (event.key === "3") {
        event.preventDefault()
        addItem("movie")
      } else if (event.key === "4") {
        event.preventDefault()
        addItem("tv")
      }
    }
    document.addEventListener("keydown", keydown)
    return () => document.removeEventListener("keydown", keydown)
  }, [addItem, onOpenChange, open, openCheckBarcode, signedIn])
  return (
    <>
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
            {signedIn && (
              <CommandGroup heading="Actions">
                <CommandItem
                  onSelect={openCheckBarcode}
                  value="action:check-barcode"
                >
                  <ScanLineIcon />
                  <span className="min-w-0 flex-1 truncate">Scan barcode</span>
                  <CommandShortcut>⌘1</CommandShortcut>
                </CommandItem>
                <CommandItem
                  onSelect={() => addItem("book")}
                  value="action:add-book"
                >
                  <BookOpenIcon />
                  <span className="min-w-0 flex-1 truncate">Add book</span>
                  <CommandShortcut>⌘2</CommandShortcut>
                </CommandItem>
                <CommandItem
                  onSelect={() => addItem("movie")}
                  value="action:add-movie"
                >
                  <FilmIcon />
                  <span className="min-w-0 flex-1 truncate">Add movie</span>
                  <CommandShortcut>⌘3</CommandShortcut>
                </CommandItem>
                <CommandItem
                  onSelect={() => addItem("tv")}
                  value="action:add-tv"
                >
                  <TvIcon />
                  <span className="min-w-0 flex-1 truncate">Add show</span>
                  <CommandShortcut>⌘4</CommandShortcut>
                </CommandItem>
              </CommandGroup>
            )}
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
                    value={`genre:${facet.slug}`}
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
                    value={`director:${facet.slug}`}
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
                    value={`actor:${facet.slug}`}
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
                    value={`author:${facet.slug}`}
                  />
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </CommandDialog>
      <CheckBarcodeDialog
        onOpenChange={setCheckBarcodeOpen}
        open={checkBarcodeOpen}
      />
    </>
  )
}
