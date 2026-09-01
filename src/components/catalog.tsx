import { SearchIcon } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { rememberCatalogQuery } from "@/components/catalog-search"
import { CoverTile } from "@/components/cover-tile"
import { Field, FieldLabel } from "@/components/ui/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Item } from "@/server/schema"

type Sort =
  "title-asc" | "title-desc" | "year-desc" | "year-asc" | "updated-desc"

const sortItems: { value: Sort; label: string }[] = [
  { value: "title-asc", label: "Title A–Z" },
  { value: "title-desc", label: "Title Z–A" },
  { value: "year-desc", label: "Year newest" },
  { value: "year-asc", label: "Year oldest" },
  { value: "updated-desc", label: "Recently updated" },
]

export function Catalog({
  items,
  type,
  query,
  onQueryChange,
  rememberQuery = true,
  fromAll = false,
  hideGenreFilter = false,
  emptyDescription = "Try a different title, creator, or filter.",
}: {
  items: Item[]
  type?: Item["type"]
  query?: string
  onQueryChange?: (query: string) => void
  rememberQuery?: boolean
  fromAll?: boolean
  hideGenreFilter?: boolean
  emptyDescription?: string
}) {
  const [draftQuery, setDraftQuery] = useState(query ?? "")
  const [genre, setGenre] = useState("all")
  const [sort, setSort] = useState<Sort>("title-asc")
  const catalogItems = type ? items.filter((item) => item.type === type) : items
  const genreOptions = [
    ...new Set(catalogItems.flatMap((item) => item.genres)),
  ].sort((left, right) => left.localeCompare(right))
  const genreItems = [
    { value: "all", label: "All genres" },
    ...genreOptions.map((option) => ({ value: option, label: option })),
  ]
  const visibleItems = useMemo(() => {
    const localQuery = onQueryChange ? "" : draftQuery.trim().toLowerCase()
    return [...catalogItems]
      .filter(
        (item) =>
          genre === "all" ||
          item.genres.some((itemGenre) => itemGenre === genre)
      )
      .filter(
        (item) =>
          !localQuery ||
          item.title.toLowerCase().includes(localQuery) ||
          item.creator.toLowerCase().includes(localQuery)
      )
      .sort((left, right) => {
        if (sort === "title-desc") return right.title.localeCompare(left.title)
        if (sort === "year-desc") return right.year - left.year
        if (sort === "year-asc") return left.year - right.year
        if (sort === "updated-desc")
          return right.updatedAt.localeCompare(left.updatedAt)
        return left.title.localeCompare(right.title)
      })
  }, [catalogItems, draftQuery, genre, onQueryChange, sort])

  useEffect(() => {
    setDraftQuery(query ?? "")
  }, [query])

  useEffect(() => {
    if (rememberQuery && type) rememberCatalogQuery(type, query)
  }, [query, rememberQuery, type])

  useEffect(() => {
    if (draftQuery === (query ?? "")) return

    const timeoutId = window.setTimeout(() => onQueryChange?.(draftQuery), 300)
    return () => window.clearTimeout(timeoutId)
  }, [draftQuery, onQueryChange, query])

  return (
    <>
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center">
        <Field className="min-w-0 flex-1">
          <FieldLabel className="sr-only" htmlFor="catalog-search">
            Search
          </FieldLabel>
          <InputGroup>
            <InputGroupAddon>
              <SearchIcon />
            </InputGroupAddon>
            <InputGroupInput
              id="catalog-search"
              onChange={(event) => setDraftQuery(event.target.value)}
              placeholder="Search the shelf"
              value={draftQuery}
            />
          </InputGroup>
        </Field>
        <div className="flex shrink-0 items-center gap-2 self-end sm:self-auto">
          {genreOptions.length > 0 && !hideGenreFilter && (
            <Field className="w-auto">
              <FieldLabel className="sr-only" htmlFor="catalog-genre">
                Genre
              </FieldLabel>
              {genreOptions.length >= 8 ? (
                <Combobox
                  items={genreItems}
                  onValueChange={(item) => setGenre(item?.value ?? "all")}
                  value={genreItems.find((item) => item.value === genre)}
                >
                  <ComboboxInput id="catalog-genre" placeholder="All genres" />
                  <ComboboxContent>
                    <ComboboxEmpty>No genres found.</ComboboxEmpty>
                    <ComboboxList>
                      {(item) => (
                        <ComboboxItem key={item.value} value={item}>
                          {item.label}
                        </ComboboxItem>
                      )}
                    </ComboboxList>
                  </ComboboxContent>
                </Combobox>
              ) : (
                <Select
                  items={genreItems}
                  onValueChange={(value) => setGenre(value ?? "all")}
                  value={genre}
                >
                  <SelectTrigger id="catalog-genre">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="all">All genres</SelectItem>
                      {genreOptions.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              )}
            </Field>
          )}
          <Field className="w-auto">
            <FieldLabel className="sr-only" htmlFor="catalog-sort">
              Sort
            </FieldLabel>
            <Select
              items={sortItems}
              onValueChange={(value) => setSort(value ?? "title-asc")}
              value={sort}
            >
              <SelectTrigger id="catalog-sort">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="title-asc">Title A–Z</SelectItem>
                  <SelectItem value="title-desc">Title Z–A</SelectItem>
                  <SelectItem value="year-desc">Year newest</SelectItem>
                  <SelectItem value="year-asc">Year oldest</SelectItem>
                  <SelectItem value="updated-desc">Recently updated</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
        </div>
      </div>

      {visibleItems.length ? (
        <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 lg:grid-cols-6">
          {visibleItems.map((item) => (
            <CoverTile fromAll={fromAll} item={item} key={item.id} />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="font-medium">Nothing found.</p>
          <span className="mt-1 block text-sm text-muted-foreground">
            {emptyDescription}
          </span>
        </div>
      )}
    </>
  )
}
