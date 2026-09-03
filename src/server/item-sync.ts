import { eq } from "drizzle-orm"
import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { db } from "./db"
import { requireSignedIn } from "./auth"
import {
  itemCast,
  itemCreators,
  replaceItemCast,
  replaceItemCreators,
  replaceItemTags,
  samePeople,
  type ProviderPerson,
} from "./item-joins"
import {
  collectionPartIdsFor,
  enrichItems,
  replaceItemCollection,
} from "./items"
import { getBookSyncMetadata } from "./openlibrary"
import { getTmdbSyncMetadata } from "./tmdb"
import type { CollectionInput } from "./providers"
import { items, type Collection, type Item, type ItemRecord } from "./schema"

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

export type ProviderSyncResult = {
  itemId: number
  slug: string
  skipped?: string
  changes?: Partial<
    Record<
      keyof SyncedFields,
      {
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
    >
  >
}

export async function syncItemFromProvider(
  item: Item | ItemRecord,
  dryRun = false
): Promise<ProviderSyncResult> {
  const syncedItem = "genres" in item ? item : (await enrichItems([item]))[0]
  const providerId =
    syncedItem.type === "book" ? syncedItem.openLibraryKey : syncedItem.tmdbId
  if (!providerId)
    return {
      itemId: syncedItem.id,
      slug: syncedItem.slug,
      skipped: `Missing ${syncedItem.type === "book" ? "Open Library key" : "TMDB ID"}.`,
    }

  const metadata =
    syncedItem.type === "book"
      ? await getBookSyncMetadata(
          providerId,
          syncedItem.coverImageUrl,
          syncedItem.isbn13
        )
      : await getTmdbSyncMetadata(syncedItem.type, providerId)

  const changes = changedFields(syncedItem, metadata)
  if (!Object.keys(changes).length) {
    if (!dryRun) {
      // Nothing changed, so only rewrite a join whose stored people differ.
      if (
        !samePeople(
          await itemCreators(syncedItem.id, syncedItem.type),
          metadata.creatorPeople
        )
      )
        await replaceItemCreators(
          syncedItem.id,
          syncedItem.type,
          metadata.creatorPeople ?? syncedItem.creator
        )
      if (
        syncedItem.type !== "book" &&
        metadata.castPeople &&
        !samePeople(await itemCast(syncedItem.id), metadata.castPeople)
      )
        await replaceItemCast(syncedItem.id, metadata.castPeople)
    }
    return {
      itemId: syncedItem.id,
      slug: syncedItem.slug,
      skipped: "Already up to date.",
    }
  }
  if (!dryRun) {
    const {
      genres: nextGenres,
      keywords: nextKeywords,
      cast: nextCast,
      collection: nextCollection,
      ...itemFields
    } = Object.fromEntries(
      Object.entries(changes).map(([field, change]) => [field, change.after])
    ) as SyncedFields
    await db
      .update(items)
      .set({
        ...itemFields,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(items.id, syncedItem.id))
    await replaceItemTags(syncedItem.id, {
      genres: nextGenres,
      keywords: nextKeywords,
    })
    if (syncedItem.type !== "book" && nextCast !== undefined)
      await replaceItemCast(
        syncedItem.id,
        metadata.castPeople ?? nextCast.map((name) => ({ name }))
      )
    if (
      (syncedItem.type === "movie" || syncedItem.type === "book") &&
      nextCollection !== undefined
    )
      await replaceItemCollection(
        syncedItem.id,
        nextCollection,
        await collectionPartIdsFor(nextCollection)
      )
    await replaceItemCreators(
      syncedItem.id,
      syncedItem.type,
      metadata.creatorPeople ?? itemFields.creator ?? syncedItem.creator
    )
  }
  return { itemId: syncedItem.id, slug: syncedItem.slug, changes }
}

export const syncItem = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.number().int() }))
  .handler(async ({ data }) => {
    await requireSignedIn()
    const [item] = await enrichItems(
      await db.select().from(items).where(eq(items.id, data.id))
    )
    if (!item) throw new Error("Item not found.")
    return syncItemFromProvider(item)
  })

function changedFields(
  item: Item,
  metadata: SyncedFields
): NonNullable<ProviderSyncResult["changes"]> {
  const changes: NonNullable<ProviderSyncResult["changes"]> = {}
  for (const field of [
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
