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

export const syncedFieldNames = [
  "title",
  "creator",
  "year",
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
] as const

export type SyncedFieldName = (typeof syncedFieldNames)[number]

// Derived purely from the provider and editable nowhere in the app, so a
// sync may replace them. Every other field is filled only while blank: a
// member may have typed it (title, creator, year, description, genres,
// cast), set it through the agent PATCH API (publisher, ISBN, subtitle,
// page count), or simply prefer what is there, and providers lowercase
// titles, list co-authors twice under case variants, pick a different
// co-director or report a re-release year.
export const providerOwnedSyncFields = new Set<SyncedFieldName>([
  "keywords",
  "collection",
])

// Written by a provider lookup that had no real value; they read as blank
// so a later sync can fill them.
const placeholders = new Set([
  "untitled",
  "unknown author",
  "director unavailable",
  "creator unavailable",
])

export function isBlankSyncValue(value: SyncChange["before"]) {
  if (value === null || value === undefined) return true
  if (typeof value === "number") return !(value > 0)
  if (typeof value === "string") {
    const trimmed = value.trim()
    return trimmed === "" || placeholders.has(trimmed.toLocaleLowerCase())
  }
  if (Array.isArray(value)) return value.length === 0
  return false
}

const screenOnlyFields = new Set<SyncedFieldName>([
  "cast",
  "certification",
  "runtime",
  "tagline",
  "logoImageUrl",
  "trailerKey",
])

export function changedFields(item: Item, metadata: SyncedFields): SyncChanges {
  const changes: SyncChanges = {}
  for (const field of syncedFieldNames) {
    if (field === "collection" && item.type !== "movie" && item.type !== "book")
      continue
    if (screenOnlyFields.has(field) && item.type === "book") continue
    const next = metadata[field]
    if (next === undefined) continue
    const previous =
      field === "collection"
        ? (item.collection ?? null)
        : field === "cast"
          ? item.actors
          : item[field]
    const blank = isBlankSyncValue(previous)
    if (!blank && !providerOwnedSyncFields.has(field)) continue
    if (blank && isBlankSyncValue(next)) continue
    if (JSON.stringify(previous) !== JSON.stringify(next))
      changes[field] = { before: previous, after: next }
  }
  return changes
}
