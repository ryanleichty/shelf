import type { ProviderPerson } from "@/server/item-joins"
import type { CollectionInput } from "@/server/providers"
import type { Collection, Item } from "@/server/schema"

export type SyncedFields = {
  title?: string
  creator?: string
  year?: number
  genres?: string[]
  description?: string
  keywords?: string[]
  cast?: string[]
  castPeople?: ProviderPerson[]
  creatorPeople?: ProviderPerson[]
  collection?: CollectionInput | null
  certification?: string | null
  runtime?: number | null
  backdropImageUrl?: string | null
  subtitle?: string | null
  pageCount?: number | null
  publisher?: string | null
  isbn13?: string | null
  tagline?: string | null
  logoImageUrl?: string | null
  trailerKey?: string | null
}

export type SyncChange = {
  before:
    | string
    | number
    | string[]
    | Collection
    | CollectionInput
    | null
    | undefined
  after: string | number | string[] | CollectionInput | null | undefined
}

export type SyncChanges = Partial<Record<keyof SyncedFields, SyncChange>>

// The fields a member curates by hand. A sync fills one that is still blank
// and never replaces a value that is already there — providers lowercase
// titles, list co-authors twice under case variants, pick a different
// co-director, or report a re-release year.
export const curatedSyncFields = ["title", "creator", "year"] as const

export type CuratedSyncField = (typeof curatedSyncFields)[number]

// Written by a provider lookup that had no real value. They read as blank so
// a later sync can fill them.
const placeholders = new Set([
  "untitled",
  "unknown author",
  "director unavailable",
  "creator unavailable",
])

export function hasCuratedValue(
  field: CuratedSyncField,
  value: string | number | null | undefined
) {
  if (field === "year") return typeof value === "number" && value > 0
  if (typeof value !== "string") return false
  const trimmed = value.trim()
  return trimmed !== "" && !placeholders.has(trimmed.toLocaleLowerCase())
}

export function changedFields(item: Item, metadata: SyncedFields): SyncChanges {
  const changes: SyncChanges = {}
  for (const field of [
    ...curatedSyncFields,
    "genres",
    "description",
    "keywords",
    "cast",
    "collection",
    "certification",
    "runtime",
    "backdropImageUrl",
    "subtitle",
    "pageCount",
    "publisher",
    "isbn13",
    "tagline",
    "logoImageUrl",
    "trailerKey",
  ] as const) {
    if (field === "collection" && item.type !== "movie" && item.type !== "book")
      continue
    if (field === "cast" && item.type === "book") continue
    if (
      (field === "certification" ||
        field === "runtime" ||
        field === "tagline" ||
        field === "logoImageUrl" ||
        field === "trailerKey") &&
      item.type === "book"
    )
      continue
    if (
      (field === "title" || field === "creator" || field === "year") &&
      hasCuratedValue(field, item[field])
    )
      continue
    const next = metadata[field]
    if (next === undefined) continue
    const previous =
      field === "collection"
        ? (item.collection ?? null)
        : field === "cast"
          ? item.actors
          : item[field]
    if (JSON.stringify(previous) !== JSON.stringify(next))
      changes[field] = { before: previous, after: next }
  }
  return changes
}
