import { displayListName } from "@/lib/system-lists"

export const itemTypes = ["book", "movie", "tv"] as const
export type ItemType = (typeof itemTypes)[number]
export const itemStatuses = [
  "owned",
  "borrowed",
  "reading",
  "watching",
] as const
export type ItemStatus = (typeof itemStatuses)[number]
export const itemEditions = ["theatrical", "extended", "director-cut"] as const
export type ItemEdition = (typeof itemEditions)[number]
export const itemFormats = [
  "hardcover",
  "paperback",
  "blu-ray",
  "dvd",
  "other",
] as const
export type ItemFormat = (typeof itemFormats)[number]
export const userRoles = ["admin", "member"] as const
export type UserRole = (typeof userRoles)[number]

export const placementKinds = [
  "recent",
  "list",
  "genre",
  "collection",
  "director",
  "actor",
  "author",
] as const
export type PlacementKind = (typeof placementKinds)[number]

// What a cover tile, carousel, or list needs. The item page fetches the rest.
export type CatalogItem = {
  id: number
  slug: string
  type: ItemType
  status: ItemStatus
  title: string
  creator: string
  year: number
  coverImageUrl: string | null
  backdropImageUrl: string | null
  tmdbId: string | null
  format: string | null
  edition: string | null
  certification: string | null
  runtime: number | null
  pageCount: number | null
  borrower: string | null
  loanDueAt: string | null
  tagline: string | null
  logoImageUrl: string | null
  trailerKey: string | null
  createdAt: string
  updatedAt: string
  genres: string[]
  authors: string[]
  directors: string[]
  collectionId: number | null
  isInSystemList: boolean
}

export type CatalogList = {
  id: number
  slug: string
  name: string
  system: boolean
}

export type CatalogPlacement = {
  id: number
  listId: number | null
  kind: PlacementKind
  sourceSlug: string
  type: ItemType
  position: number
  visible: boolean
  slug: string | null
  name: string | null
}

export type CatalogCollection = {
  id: number
  slug: string
  name: string
  overview: string | null
  partIds: string[] | null
}

export type Catalog = {
  items: CatalogItem[]
  lists: CatalogList[]
  memberships: Array<{ listId: number; itemId: number; position: number }>
  placements: CatalogPlacement[]
  collections: CatalogCollection[]
  // actor slug → item ids, only for actors that have a catalog placement
  actorItems: Record<string, number[]>
}

export type HomeRow =
  | { title: string; kind: "recent"; items: CatalogItem[] }
  | {
      title: string
      kind: Exclude<PlacementKind, "recent">
      slug: string
      items: CatalogItem[]
    }

export function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

export const normalizeTitle = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]/g, "")

export const normalizeEdition = (edition?: string | null) =>
  edition?.trim() || null

export function yearFromDate(value?: string) {
  const match = value?.match(/\b(\d{4})\b/)
  return match ? Number(match[1]) : null
}

export function parseCreatorNames(creator: string) {
  return creator
    .split(/,|\s+and\s+|\s+&\s+/i)
    .map((name) => name.trim())
    .filter(Boolean)
}

export function systemListSlug(type: ItemType) {
  return type === "book" ? "reading-list" : "watchlist"
}

export function statusLabel(status: Exclude<ItemStatus, "owned">) {
  return status === "reading"
    ? "Reading"
    : status === "watching"
      ? "Watching"
      : "Borrowed"
}

const byTitle = (left: CatalogItem, right: CatalogItem) =>
  left.title.localeCompare(right.title)

export function itemsOfType(catalog: Catalog, type: ItemType) {
  return catalog.items.filter((item) => item.type === type)
}

export function recentItems<T extends CatalogItem>(items: T[], count: number) {
  return [...items]
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, count)
}

export function listItems(catalog: Catalog, listId: number, type?: ItemType) {
  const byId = new Map(catalog.items.map((item) => [item.id, item]))
  return [...catalog.memberships]
    .filter((membership) => membership.listId === listId)
    .sort((left, right) => left.position - right.position)
    .flatMap((membership) => {
      const item = byId.get(membership.itemId)
      return item && (!type || item.type === type) ? [item] : []
    })
}

export function homeRows(catalog: Catalog, type: ItemType): HomeRow[] {
  const all = itemsOfType(catalog, type)
  return catalog.placements
    .filter((placement) => placement.type === type && placement.visible)
    .sort((left, right) => left.position - right.position)
    .flatMap<HomeRow>((placement) => {
      if (placement.kind === "recent") {
        const items = [...all]
          .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
          .slice(0, 12)
        return items.length
          ? [{ title: "Recently added", kind: "recent", items }]
          : []
      }
      if (placement.kind === "list") {
        if (placement.listId === null || !placement.slug || !placement.name)
          return []
        const items = listItems(catalog, placement.listId, type)
        return items.length
          ? [
              {
                title: displayListName(placement.slug, placement.name),
                kind: "list",
                slug: placement.slug,
                items,
              },
            ]
          : []
      }
      const slug = placement.sourceSlug
      const items =
        placement.kind === "genre"
          ? all.filter((item) => item.genres.some((g) => slugify(g) === slug))
          : placement.kind === "collection"
            ? all.filter(
                (item) =>
                  catalog.collections.find((c) => c.id === item.collectionId)
                    ?.slug === slug
              )
            : placement.kind === "director"
              ? all.filter((item) =>
                  item.directors.some((d) => slugify(d) === slug)
                )
              : placement.kind === "author"
                ? all.filter((item) =>
                    item.authors.some((a) => slugify(a) === slug)
                  )
                : all.filter((item) =>
                    catalog.actorItems[slug]?.includes(item.id)
                  )
      const title =
        placement.name ??
        (placement.kind === "genre"
          ? items.flatMap((i) => i.genres).find((g) => slugify(g) === slug)
          : placement.kind === "director"
            ? items.flatMap((i) => i.directors).find((d) => slugify(d) === slug)
            : placement.kind === "author"
              ? items.flatMap((i) => i.authors).find((a) => slugify(a) === slug)
              : undefined)
      if (!items.length || !title) return []
      return [{ title, kind: placement.kind, slug, items }]
    })
}

export function listPage(catalog: Catalog, type: ItemType, slug: string) {
  const list = catalog.lists.find((candidate) => candidate.slug === slug)
  const placement = catalog.placements.find(
    (candidate) => candidate.listId === list?.id && candidate.type === type
  )
  if (!list || !placement) return null
  const items = listItems(catalog, list.id, type)
  return {
    name: displayListName(slug, list.name),
    items,
    totalCount: items.length,
    collageItems: items.filter((item) => item.coverImageUrl).slice(0, 4),
  }
}

export function genrePage(catalog: Catalog, slug: string) {
  const items = catalog.items
    .filter((item) => item.genres.some((genre) => slugify(genre) === slug))
    .sort(byTitle)
  const name = items
    .flatMap((item) => item.genres)
    .find((genre) => slugify(genre) === slug)
  return name ? { name, items } : null
}

export function collectionPage(catalog: Catalog, slug: string) {
  const collection = catalog.collections.find((c) => c.slug === slug)
  if (!collection) return null
  return {
    ...collection,
    items: catalog.items
      .filter((item) => item.collectionId === collection.id)
      .sort(byTitle),
  }
}

export function yearBrowse(
  catalog: Catalog,
  type: ItemType,
  startYear: number,
  endYear: number
) {
  const all = itemsOfType(catalog, type)
  return {
    years: [...new Set(all.map((item) => item.year))].sort((a, b) => a - b),
    items: all
      .filter((item) => item.year >= startYear && item.year <= endYear)
      .sort(byTitle),
  }
}

export function sidebarLists(catalog: Catalog) {
  return catalog.placements.flatMap((placement) =>
    placement.kind === "list" && placement.slug && placement.name
      ? [
          {
            slug: placement.slug,
            name: displayListName(placement.slug, placement.name),
            type: placement.type,
          },
        ]
      : []
  )
}

export function matchesQuery(item: CatalogItem, query: string) {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (!terms.length) return true
  const haystack = [
    item.title,
    item.creator,
    ...item.genres,
    ...item.authors,
    ...item.directors,
  ]
    .join(" ")
    .toLowerCase()
  return terms.every((term) => haystack.includes(term))
}
