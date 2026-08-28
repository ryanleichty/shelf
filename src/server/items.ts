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

const lookupInput = z.object({
  query: z.string().trim().min(2).max(160),
  type: z.enum(itemTypes),
})

export type LookupResult = {
  id: string
  type: "book" | "movie"
  title: string
  creator: string
  year: number | null
  coverImageUrl: string
}

const slugify = (title: string) =>
  title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")

export const searchCollection = createServerFn({ method: "GET" })
  .validator(lookupInput)
  .handler(async ({ data }): Promise<LookupResult[]> => {
    requireAdmin()
    if (data.type === "book") {
      const url = new URL("https://openlibrary.org/search.json")
      url.searchParams.set("q", data.query)
      url.searchParams.set("fields", "key,title,author_name,first_publish_year,cover_i")
      url.searchParams.set("limit", "6")
      const response = await fetch(url, {
        headers: { "User-Agent": "Shelf (https://github.com/ryanleichty/shelf)" },
      })
      if (!response.ok) throw new Error("Open Library could not complete that search.")
      const body = (await response.json()) as {
        docs?: Array<{
          key?: string
          title?: string
          author_name?: string[]
          first_publish_year?: number
          cover_i?: number
        }>
      }
      return (body.docs ?? []).flatMap((book) =>
        book.key && book.title
          ? [{
              id: book.key,
              type: "book" as const,
              title: book.title,
              creator: book.author_name?.[0] ?? "Unknown author",
              year: book.first_publish_year ?? null,
              coverImageUrl: book.cover_i
                ? `https://covers.openlibrary.org/b/id/${book.cover_i}-L.jpg`
                : "",
            }]
          : [],
      )
    }

    const apiKey = process.env.TMDB_API_KEY
    if (!apiKey) throw new Error("Movie search needs TMDB_API_KEY. Add a free TMDB API key to your environment.")
    const url = new URL("https://api.themoviedb.org/3/search/movie")
    url.searchParams.set("query", data.query)
    url.searchParams.set("include_adult", "false")
    url.searchParams.set("language", "en-US")
    url.searchParams.set("api_key", apiKey)
    const response = await fetch(url)
    if (!response.ok) throw new Error("TMDB could not complete that search. Check TMDB_API_KEY.")
    const body = (await response.json()) as {
      results?: Array<{ id: number; title?: string; release_date?: string; poster_path?: string | null }>
    }
    return (body.results ?? []).flatMap((movie) =>
      movie.title
        ? [{
            id: String(movie.id),
            type: "movie" as const,
            title: movie.title,
            creator: "Director unavailable",
            year: movie.release_date ? Number(movie.release_date.slice(0, 4)) : null,
            coverImageUrl: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : "",
          }]
        : [],
    )
  })

export const getCollectionResult = createServerFn({ method: "GET" })
  .validator(z.object({ id: z.string().min(1), type: z.enum(itemTypes) }))
  .handler(async ({ data }): Promise<LookupResult & { slug: string }> => {
    requireAdmin()
    if (data.type === "book") {
      const response = await fetch(`https://openlibrary.org${data.id}.json`, {
        headers: { "User-Agent": "Shelf (https://github.com/ryanleichty/shelf)" },
      })
      if (!response.ok) throw new Error("Open Library could not load that book.")
      const book = (await response.json()) as { title?: string; first_publish_date?: string }
      const title = book.title ?? "Untitled"
      return { id: data.id, type: "book", title, creator: "Unknown author", year: book.first_publish_date ? Number(book.first_publish_date.slice(-4)) || null : null, coverImageUrl: "", slug: slugify(title) }
    }

    const apiKey = process.env.TMDB_API_KEY
    if (!apiKey) throw new Error("Movie search needs TMDB_API_KEY. Add a free TMDB API key to your environment.")
    const url = new URL(`https://api.themoviedb.org/3/movie/${data.id}`)
    url.searchParams.set("append_to_response", "credits")
    url.searchParams.set("api_key", apiKey)
    const response = await fetch(url)
    if (!response.ok) throw new Error("TMDB could not load that movie. Check TMDB_API_KEY.")
    const movie = (await response.json()) as {
      title?: string; release_date?: string; poster_path?: string | null
      credits?: { crew?: Array<{ job?: string; name?: string }> }
    }
    const title = movie.title ?? "Untitled"
    return {
      id: data.id, type: "movie", title,
      creator: movie.credits?.crew?.find((person) => person.job === "Director")?.name ?? "Director unavailable",
      year: movie.release_date ? Number(movie.release_date.slice(0, 4)) || null : null,
      coverImageUrl: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : "",
      slug: slugify(title),
    }
  })

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
