import { and, asc, eq, inArray, sql } from "drizzle-orm"
import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { displayListName } from "@/lib/system-lists"
import { slugify } from "@/lib/catalog"
import { requireSignedIn } from "./auth"
import { db } from "./db"
import {
  actors,
  authors,
  collections,
  directors,
  genres,
  itemActors,
  itemAuthors,
  itemCollections,
  itemDirectors,
  itemGenres,
  items,
  itemTypes,
  listItems,
  listPlacements,
  lists,
} from "./schema"

const listName = z.string().trim().min(1).max(80)
const placementInput = z.object({
  placementId: z.number().int(),
  type: z.enum(itemTypes),
})
const catalogPlacementKinds = [
  "genre",
  "collection",
  "director",
  "actor",
  "author",
] as const
const catalogPlacementInput = z.object({
  type: z.enum(itemTypes),
  kind: z.enum(catalogPlacementKinds),
  slugs: z.array(z.string().min(1).max(120)).min(1).max(100),
})

async function uniqueListSlug(name: string) {
  const base = slugify(name) || "list"
  for (let suffix = 1; ; suffix++) {
    const slug = suffix === 1 ? base : `${base}-${suffix}`
    const [existing] = await db
      .select({ id: lists.id })
      .from(lists)
      .where(eq(lists.slug, slug))
      .limit(1)
    if (!existing) return slug
  }
}

export const getListPlacements = createServerFn({ method: "GET" }).handler(
  async () => {
    const placements = await db
      .select({
        id: listPlacements.id,
        listId: listPlacements.listId,
        slug: lists.slug,
        name: sql<string | null>`coalesce(
          ${lists.name},
          case ${listPlacements.kind}
            when 'genre' then (select name from ${genres} where slug = ${listPlacements.sourceSlug})
            when 'collection' then (select name from ${collections} where slug = ${listPlacements.sourceSlug})
            when 'director' then (select name from ${directors} where slug = ${listPlacements.sourceSlug})
            when 'actor' then (select name from ${actors} where slug = ${listPlacements.sourceSlug})
            when 'author' then (select name from ${authors} where slug = ${listPlacements.sourceSlug})
          end
        )`,
        system: lists.system,
        kind: listPlacements.kind,
        sourceSlug: listPlacements.sourceSlug,
        type: listPlacements.type,
        position: listPlacements.position,
        visible: listPlacements.visible,
      })
      .from(listPlacements)
      .leftJoin(lists, eq(listPlacements.listId, lists.id))
      .orderBy(asc(listPlacements.type), asc(listPlacements.position))
    return placements.map((placement) => ({
      ...placement,
      name: displayListName(placement.slug, placement.name),
    }))
  }
)

export const getCatalogPlacementOptions = createServerFn({
  method: "GET",
}).handler(async () => {
  const options = await Promise.all([
    db
      .selectDistinct({
        type: items.type,
        slug: genres.slug,
        name: genres.name,
      })
      .from(itemGenres)
      .innerJoin(genres, eq(itemGenres.genreId, genres.id))
      .innerJoin(items, eq(itemGenres.itemId, items.id))
      .orderBy(asc(genres.name)),
    db
      .selectDistinct({
        type: items.type,
        slug: collections.slug,
        name: collections.name,
      })
      .from(itemCollections)
      .innerJoin(collections, eq(itemCollections.collectionId, collections.id))
      .innerJoin(items, eq(itemCollections.itemId, items.id))
      .orderBy(asc(collections.name)),
    db
      .selectDistinct({
        type: items.type,
        slug: directors.slug,
        name: directors.name,
      })
      .from(itemDirectors)
      .innerJoin(directors, eq(itemDirectors.directorId, directors.id))
      .innerJoin(items, eq(itemDirectors.itemId, items.id))
      .orderBy(asc(directors.name)),
    db
      .selectDistinct({
        type: items.type,
        slug: actors.slug,
        name: actors.name,
      })
      .from(itemActors)
      .innerJoin(actors, eq(itemActors.actorId, actors.id))
      .innerJoin(items, eq(itemActors.itemId, items.id))
      .orderBy(asc(actors.name)),
    db
      .selectDistinct({
        type: items.type,
        slug: authors.slug,
        name: authors.name,
      })
      .from(itemAuthors)
      .innerJoin(authors, eq(itemAuthors.authorId, authors.id))
      .innerJoin(items, eq(itemAuthors.itemId, items.id))
      .orderBy(asc(authors.name)),
  ])
  return {
    genre: options[0],
    collection: options[1].filter((option) => option.type === "movie"),
    director: options[2].filter((option) => option.type !== "book"),
    actor: options[3].filter((option) => option.type !== "book"),
    author: options[4].filter((option) => option.type === "book"),
  }
})

export const getSidebarLists = createServerFn({ method: "GET" }).handler(
  async () =>
    (await getListPlacements()).filter(
      (placement) =>
        placement.kind === "list" && placement.slug && placement.name
    )
)

export const createList = createServerFn({ method: "POST" })
  .inputValidator(z.object({ name: listName, type: z.enum(itemTypes) }))
  .handler(async ({ data }) => {
    await requireSignedIn()
    const slug = await uniqueListSlug(data.name)
    const [list] = await db
      .insert(lists)
      .values({
        slug,
        name: data.name,
        system: false,
        createdAt: new Date().toISOString(),
      })
      .returning({ id: lists.id })
    const [{ position }] = await db
      .select({
        position: sql<number>`coalesce(max(${listPlacements.position}), -1)`,
      })
      .from(listPlacements)
      .where(eq(listPlacements.type, data.type))
    await db.insert(listPlacements).values({
      listId: list.id,
      kind: "list",
      sourceSlug: slug,
      type: data.type,
      position: position + 1,
      visible: true,
    })
    return { ok: true }
  })

export const addCatalogPlacements = createServerFn({ method: "POST" })
  .inputValidator(catalogPlacementInput)
  .handler(async ({ data }) => {
    await requireSignedIn()
    const [{ position }] = await db
      .select({
        position: sql<number>`coalesce(max(${listPlacements.position}), -1)`,
      })
      .from(listPlacements)
      .where(eq(listPlacements.type, data.type))
    const existing = await db
      .select({ sourceSlug: listPlacements.sourceSlug })
      .from(listPlacements)
      .where(
        and(
          eq(listPlacements.type, data.type),
          eq(listPlacements.kind, data.kind),
          inArray(listPlacements.sourceSlug, data.slugs)
        )
      )
    const existingSlugs = new Set(
      existing.flatMap((placement) =>
        placement.sourceSlug ? [placement.sourceSlug] : []
      )
    )
    const slugs = data.slugs.filter((slug) => !existingSlugs.has(slug))
    if (!slugs.length) return { ok: true }
    await db.insert(listPlacements).values(
      slugs.map((sourceSlug, index) => ({
        kind: data.kind,
        sourceSlug,
        type: data.type,
        position: position + index + 1,
        visible: true,
      }))
    )
    return { ok: true }
  })

export const renameList = createServerFn({ method: "POST" })
  .inputValidator(z.object({ listId: z.number().int(), name: listName }))
  .handler(async ({ data }) => {
    await requireSignedIn()
    const [list] = await db
      .select({ system: lists.system })
      .from(lists)
      .where(eq(lists.id, data.listId))
      .limit(1)
    if (!list || list.system)
      throw new Error("This system list cannot be renamed.")
    await db
      .update(lists)
      .set({ name: data.name })
      .where(eq(lists.id, data.listId))
    return { ok: true }
  })

export const deleteList = createServerFn({ method: "POST" })
  .inputValidator(z.object({ listId: z.number().int() }))
  .handler(async ({ data }) => {
    await requireSignedIn()
    const [list] = await db
      .select({ system: lists.system })
      .from(lists)
      .where(eq(lists.id, data.listId))
      .limit(1)
    if (!list || list.system)
      throw new Error("This system list cannot be deleted.")
    await db.delete(lists).where(eq(lists.id, data.listId))
    return { ok: true }
  })

export const deleteCatalogPlacement = createServerFn({ method: "POST" })
  .inputValidator(placementInput)
  .handler(async ({ data }) => {
    await requireSignedIn()
    await db
      .delete(listPlacements)
      .where(
        and(
          eq(listPlacements.id, data.placementId),
          eq(listPlacements.type, data.type),
          inArray(listPlacements.kind, catalogPlacementKinds)
        )
      )
    return { ok: true }
  })

export const setListPlacementVisible = createServerFn({ method: "POST" })
  .inputValidator(placementInput.extend({ visible: z.boolean() }))
  .handler(async ({ data }) => {
    await requireSignedIn()
    await db
      .update(listPlacements)
      .set({ visible: data.visible })
      .where(
        and(
          eq(listPlacements.id, data.placementId),
          eq(listPlacements.type, data.type)
        )
      )
    return { ok: true }
  })

export const reorderListPlacements = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      type: z.enum(itemTypes),
      placementIds: z.array(z.number().int().positive()).max(1_000),
    })
  )
  .handler(async ({ data }) => {
    await requireSignedIn()
    const placements = await db
      .select({
        id: listPlacements.id,
      })
      .from(listPlacements)
      .where(eq(listPlacements.type, data.type))
      .orderBy(asc(listPlacements.position))
    const storedIds = new Set(placements.map((placement) => placement.id))
    const requestedIds = new Set(data.placementIds)
    if (
      storedIds.size !== requestedIds.size ||
      storedIds.size !== data.placementIds.length ||
      [...storedIds].some((id) => !requestedIds.has(id))
    ) {
      throw new Error("The list order is out of date. Refresh and try again.")
    }
    await db.transaction(async (tx) => {
      await Promise.all(
        data.placementIds.map((placementId, position) =>
          tx
            .update(listPlacements)
            .set({ position })
            .where(
              and(
                eq(listPlacements.id, placementId),
                eq(listPlacements.type, data.type)
              )
            )
        )
      )
    })
    return { ok: true }
  })

const listMembershipInput = z.object({
  itemId: z.number().int(),
  listSlug: z.string().min(1).max(120),
})

export const addItemToList = createServerFn({ method: "POST" })
  .inputValidator(listMembershipInput)
  .handler(async ({ data }) => {
    await requireSignedIn()
    const [list] = await db
      .select({ id: lists.id })
      .from(lists)
      .where(eq(lists.slug, data.listSlug))
      .limit(1)
    if (!list) throw new Error("List not found.")
    const [item] = await db
      .select({ status: items.status })
      .from(items)
      .where(eq(items.id, data.itemId))
      .limit(1)
    if (!item) throw new Error("Item not found.")
    if (item.status === "wanted") throw new Error("You don't own that yet.")
    await db
      .insert(listItems)
      .values({
        listId: list.id,
        itemId: data.itemId,
        position: Date.now(),
        addedAt: new Date().toISOString(),
      })
      .onConflictDoNothing()
    return { ok: true }
  })

export const removeItemFromList = createServerFn({ method: "POST" })
  .inputValidator(listMembershipInput)
  .handler(async ({ data }) => {
    await requireSignedIn()
    const [list] = await db
      .select({ id: lists.id })
      .from(lists)
      .where(eq(lists.slug, data.listSlug))
      .limit(1)
    if (list)
      await db
        .delete(listItems)
        .where(
          and(eq(listItems.listId, list.id), eq(listItems.itemId, data.itemId))
        )
    return { ok: true }
  })
