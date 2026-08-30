import { and, asc, eq, sql } from "drizzle-orm"
import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { requireSignedIn } from "./auth"
import { db, ensureDatabase } from "./db"
import { itemTypes, listItems, listPlacements, lists } from "./schema"

const listName = z.string().trim().min(1).max(80)
const placementInput = z.object({
  placementId: z.number().int(),
  type: z.enum(itemTypes),
})

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

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
    await ensureDatabase()
    return db
      .select({
        id: listPlacements.id,
        listId: listPlacements.listId,
        slug: lists.slug,
        name: lists.name,
        system: lists.system,
        kind: listPlacements.kind,
        type: listPlacements.type,
        position: listPlacements.position,
        visible: listPlacements.visible,
      })
      .from(listPlacements)
      .leftJoin(lists, eq(listPlacements.listId, lists.id))
      .orderBy(asc(listPlacements.type), asc(listPlacements.position))
  }
)

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
    await ensureDatabase()
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
      type: data.type,
      position: position + 1,
      visible: true,
    })
    return { ok: true }
  })

export const renameList = createServerFn({ method: "POST" })
  .inputValidator(z.object({ listId: z.number().int(), name: listName }))
  .handler(async ({ data }) => {
    await requireSignedIn()
    await ensureDatabase()
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
    await ensureDatabase()
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

export const setListPlacementVisible = createServerFn({ method: "POST" })
  .inputValidator(placementInput.extend({ visible: z.boolean() }))
  .handler(async ({ data }) => {
    await requireSignedIn()
    await ensureDatabase()
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

export const moveListPlacement = createServerFn({ method: "POST" })
  .inputValidator(placementInput.extend({ direction: z.enum(["up", "down"]) }))
  .handler(async ({ data }) => {
    await requireSignedIn()
    await ensureDatabase()
    const placements = await db
      .select({
        id: listPlacements.id,
        position: listPlacements.position,
      })
      .from(listPlacements)
      .where(eq(listPlacements.type, data.type))
      .orderBy(asc(listPlacements.position))
    const index = placements.findIndex(
      (placement) => placement.id === data.placementId
    )
    const nextIndex = index + (data.direction === "up" ? -1 : 1)
    if (index < 0 || nextIndex < 0 || nextIndex >= placements.length)
      return { ok: true }
    const current = placements[index]!
    const adjacent = placements[nextIndex]!
    await db
      .update(listPlacements)
      .set({ position: adjacent.position })
      .where(
        and(
          eq(listPlacements.id, current.id),
          eq(listPlacements.type, data.type)
        )
      )
    await db
      .update(listPlacements)
      .set({ position: current.position })
      .where(
        and(
          eq(listPlacements.id, adjacent.id),
          eq(listPlacements.type, data.type)
        )
      )
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
    await ensureDatabase()
    const [list] = await db
      .select({ id: lists.id })
      .from(lists)
      .where(eq(lists.slug, data.listSlug))
      .limit(1)
    if (!list) throw new Error("List not found.")
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
    await ensureDatabase()
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
