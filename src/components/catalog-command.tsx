"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "@tanstack/react-router"
import {
  Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command"
import { getItems } from "@/server/items"
import type { Item } from "@/server/schema"

export function CatalogCommand({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [items, setItems] = useState<Item[]>([])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      getItems({ data: query ? { query } : {} }).then(setItems).catch(() => setItems([]))
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

  const books = useMemo(() => items.filter((item) => item.type === "book"), [items])
  const movies = useMemo(() => items.filter((item) => item.type === "movie"), [items])
  const select = (item: Item) => {
    onOpenChange(false)
    router.navigate({ to: "/item/$slug", params: { slug: item.slug } })
  }
  return <CommandDialog onOpenChange={onOpenChange} open={open} title="Search Shelf">
    <Command shouldFilter={false}>
      <CommandInput onValueChange={setQuery} placeholder="Search Shelf…" value={query} />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        {books.length > 0 && <CommandGroup heading="Books">{books.map((item) => <CommandItem key={item.id} onSelect={() => select(item)} value={item.title}><span>{item.title}</span><span className="ml-auto text-xs text-muted-foreground">{item.creator}</span></CommandItem>)}</CommandGroup>}
        {movies.length > 0 && <CommandGroup heading="Movies">{movies.map((item) => <CommandItem key={item.id} onSelect={() => select(item)} value={item.title}><span>{item.title}</span><span className="ml-auto text-xs text-muted-foreground">{item.creator}</span></CommandItem>)}</CommandGroup>}
      </CommandList>
    </Command>
  </CommandDialog>
}
