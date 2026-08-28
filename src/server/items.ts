import { and, asc, eq, like, or } from "drizzle-orm"
import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { db } from "./db"
import { requireAdmin } from "./auth"
import { items, itemTypes } from "./schema"

const itemInput = z.object({
  id: z.number().int().optional(),
  slug: z.string().min(1).max(120),
  type: z.enum(itemTypes),
  title: z.string().min(1).max(240),
  creator: z.string().min(1).max(240),
  year: z.number().int().min(0).max(3000),
  coverImageUrl: z.string().url().optional().or(z.literal("")),
  notes: z.string().max(10000).default(""),
  acquiredAt: z.string().date().optional().or(z.literal("")),
})

export type ItemInput = z.infer<typeof itemInput>

export const getItems = createServerFn({ method: "GET" })
  .validator(
    z
      .object({
        type: z.enum(itemTypes).optional(),
        query: z.string().max(100).optional(),
      })
      .optional(),
  )
  .handler(async ({ data }) => {
    const filters = []
    if (data?.type) filters.push(eq(items.type, data.type))
    if (data?.query?.trim()) {
      const search = `%${data.query.trim()}%`
      filters.push(or(like(items.title, search), like(items.creator, search))!)
    }
    return db
      .select()
      .from(items)
      .where(filters.length ? and(...filters) : undefined)
      .orderBy(asc(items.title))
  })

export const getItemBySlug = createServerFn({ method: "GET" })
  .validator(z.object({ slug: z.string() }))
  .handler(async ({ data }) => {
    const [item] = await db.select().from(items).where(eq(items.slug, data.slug))
    return item ?? null
  })

export const getItemById = createServerFn({ method: "GET" })
  .validator(z.object({ id: z.number().int() }))
  .handler(async ({ data }) => {
    requireAdmin()
    const [item] = await db.select().from(items).where(eq(items.id, data.id))
    return item ?? null
  })

export const getAdminStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { isAdmin } = await import("./auth")
  return isAdmin()
})

export const saveItem = createServerFn({ method: "POST" })
  .validator(itemInput)
  .handler(async ({ data }) => {
    requireAdmin()
    const now = new Date().toISOString()
    const values = {
      ...data,
      coverImageUrl: data.coverImageUrl || null,
      acquiredAt: data.acquiredAt || null,
      updatedAt: now,
    }
    if (data.id) {
      await db.update(items).set(values).where(eq(items.id, data.id))
      return { id: data.id, slug: data.slug }
    }
    const [item] = await db
      .insert(items)
      .values({ ...values, createdAt: now })
      .returning({ id: items.id, slug: items.slug })
    return item
  })

export const deleteItem = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.number().int() }))
  .handler(async ({ data }) => {
    requireAdmin()
    await db.delete(items).where(eq(items.id, data.id))
    return { ok: true }
  })

export const login = createServerFn({ method: "POST" })
  .validator(z.object({ password: z.string() }))
  .handler(async ({ data }) => {
    const { startAdminSession, verifyPassword } = await import("./auth")
    if (!verifyPassword(data.password)) return { ok: false }
    startAdminSession()
    return { ok: true }
  })

export const logout = createServerFn({ method: "POST" }).handler(async () => {
  const { endAdminSession } = await import("./auth")
  endAdminSession()
  return { ok: true }
})
