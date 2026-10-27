import { eq } from "drizzle-orm"
import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { db } from "./db"
import { requireSignedIn } from "./auth"
import {
  itemCast,
  replaceItemCast,
  replaceItemCreators,
  replaceItemTags,
  samePeople,
} from "./item-joins"
import {
  collectionPartIdsFor,
  enrichItems,
  replaceItemCollection,
} from "./items"
import { getBookSyncMetadata } from "./openlibrary"
import { getTmdbSyncMetadata } from "./tmdb"
import { items, type Item, type ItemRecord } from "./schema"
import {
  changedFields,
  type SyncChanges,
  type SyncedFields,
} from "@/lib/sync-fields"

export type { SyncedFields } from "@/lib/sync-fields"

export type ProviderSyncResult = {
  itemId: number
  slug: string
  skipped?: string
  changes?: SyncChanges
}

// Title, creator and year are curated (see `curatedSyncFields`): the sync
// fills them only while blank, and the creator join follows the creator
// field — it is rewritten only when the field itself is being filled, so a
// provider's co-author list never replaces the people a member chose.
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
    if (
      !dryRun &&
      syncedItem.type !== "book" &&
      metadata.castPeople &&
      !samePeople(await itemCast(syncedItem.id), metadata.castPeople)
    )
      // Nothing changed, so only rewrite a cast join whose people differ.
      await replaceItemCast(syncedItem.id, metadata.castPeople)
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
    if (itemFields.creator !== undefined)
      await replaceItemCreators(
        syncedItem.id,
        syncedItem.type,
        metadata.creatorPeople ?? itemFields.creator
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
