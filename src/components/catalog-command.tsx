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
import { getItems } from "@/server/items"
import type { Item } from "@/server/schema"

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

  useEffect(() => {
    const timer = window.setTimeout(() => {
      getItems({ data: query ? { query } : {} })
        .then(setItems)
        .catch(() => setItems([]))
    }, 150)
    return () => window.clearTimeout(timer)
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
        </CommandList>
      </Command>
    </CommandDialog>
  )
}
