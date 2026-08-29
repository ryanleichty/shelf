import { and, asc, eq, like, or } from "drizzle-orm"
import { createServerFn } from "@tanstack/react-start"
import { getRequestHeader } from "@tanstack/react-start/server"
import { z } from "zod"
import { db, ensureDatabase } from "./db"
import { isAgentToken, requireAdmin } from "./auth"
import { storeCover } from "./covers"
import { items, itemStatuses, itemTypes } from "./schema"

const itemInput = z.object({
  id: z.number().int().optional(),
  slug: z.string().min(1).max(120),
  type: z.enum(itemTypes),
  status: z.enum(itemStatuses).default("owned"),
  title: z.string().min(1).max(240),
  creator: z.string().min(1).max(240),
  year: z.number().int().min(0).max(3000),
  coverImageUrl: z.string().url().optional().or(z.literal("")),
  openLibraryKey: z.string().max(120).optional().or(z.literal("")),
  tmdbId: z.string().max(40).optional().or(z.literal("")),
  borrower: z.string().max(120).optional().or(z.literal("")),
  loanedAt: z.string().date().optional().or(z.literal("")),
  format: z.enum(["hardcover", "paperback", "blu-ray", "dvd", "other"]).optional().or(z.literal("")),
}).superRefine((item, context) => {
  if (item.type === "movie" && item.status === "reading") {
    context.addIssue({ code: "custom", message: "Movies cannot have Reading status.", path: ["status"] })
  }
  if (item.status === "borrowed" && !item.borrower?.trim()) {
    context.addIssue({ code: "custom", message: "Borrowed items need a borrower.", path: ["borrower"] })
  }
  if (item.status !== "borrowed" && (item.borrower || item.loanedAt)) {
    context.addIssue({ code: "custom", message: "Loan details only apply to borrowed items.", path: ["status"] })
  }
  if (item.type === "book" && ["blu-ray", "dvd"].includes(item.format ?? "")) {
    context.addIssue({ code: "custom", message: "Choose a book format.", path: ["format"] })
  }
  if (item.type === "movie" && ["hardcover", "paperback"].includes(item.format ?? "")) {
    context.addIssue({ code: "custom", message: "Choose a movie format.", path: ["format"] })
  }
})

export type ItemInput = z.infer<typeof itemInput>

const lookupInput = z.object({
  query: z.string().trim().min(2).max(160),
  type: z.enum(itemTypes),
})

export const importItems = createServerFn({ method: "POST" })
  .validator(z.object({
    type: z.enum(itemTypes),
    format: z.enum(["hardcover", "paperback", "blu-ray", "dvd", "other"]).optional().or(z.literal("")),
    queries: z.array(z.string().trim().min(1).max(200)).min(1).max(80),
  }))
  .handler(async ({ data }) => {
    if (!isAgentToken(getRequestHeader("authorization"))) requireAdmin()
    await ensureDatabase()
    const added: Array<{ title: string; slug: string }> = []
    const skipped: Array<{ query: string; reason: string }> = []
    const failed: Array<{ query: string; reason: string }> = []
    for (const query of data.queries) {
      try {
        const matches = await searchCollection({ data: { type: data.type, query } })
        const match = matches[0]
        if (!match) { skipped.push({ query, reason: "No match found" }); continue }
        const resolved = data.type === "movie"
          ? await getCollectionResult({ data: { type: "movie", id: match.id } })
          : { ...match, slug: slugify(match.title) }
        const providerWhere = data.type === "movie" ? eq(items.tmdbId, match.id) : eq(items.openLibraryKey, match.id)
        const existing = await db.select({ id: items.id }).from(items).where(or(eq(items.slug, resolved.slug), providerWhere)).limit(1)
        if (existing.length) { skipped.push({ query, reason: "Already on Shelf" }); continue }
        const now = new Date().toISOString()
        await db.insert(items).values({
          slug: resolved.slug, type: data.type, status: "owned", title: resolved.title,
          creator: resolved.creator, year: resolved.year ?? 0,
          coverImageUrl: (await storeCover(resolved.coverImageUrl, resolved.slug)) || null,
          openLibraryKey: data.type === "book" ? match.id : null,
          tmdbId: data.type === "movie" ? match.id : null,
          format: data.format || null, notes: "", acquiredAt: null, createdAt: now, updatedAt: now,
        })
        added.push({ title: resolved.title, slug: resolved.slug })
      } catch (cause) {
        failed.push({ query, reason: cause instanceof Error ? cause.message : "Import failed" })
      }
    }
    return { added, skipped, failed }
  })

export type LookupResult = {
  id: string
  type: "book" | "movie"
  title: string
  creator: string
  year: number | null
  coverImageUrl: string
}

export const getCoverOptions = createServerFn({ method: "GET" })
  .validator(z.object({
    type: z.enum(itemTypes),
    openLibraryKey: z.string().optional(),
    tmdbId: z.string().optional(),
  }))
  .handler(async ({ data }): Promise<string[]> => {
    requireAdmin()
    if (data.type === "book" && data.openLibraryKey) {
      const workId = data.openLibraryKey.replace(/^\/?works\//, "")
      const response = await fetch(`https://openlibrary.org/works/${workId}/editions.json?limit=100`, {
        headers: { "User-Agent": "Shelf (https://github.com/ryanleichty/shelf)" },
      })
      if (!response.ok) throw new Error("Open Library could not load edition covers.")
      const body = (await response.json()) as {
        entries?: Array<{ covers?: number[]; languages?: Array<{ key?: string }> }>
      }
      const editions = body.entries ?? []
      const allCovers = [...new Set(editions.flatMap((edition) => edition.covers ?? []))]
      const englishCovers = [...new Set(editions
        .filter((edition) => edition.languages?.some((language) => language.key?.endsWith("/eng")))
        .flatMap((edition) => edition.covers ?? []))]
      const covers = (englishCovers.length ? englishCovers : allCovers).slice(0, 18)
      return covers.map((id) => `https://covers.openlibrary.org/b/id/${id}-L.jpg`)
    }
    if (data.type === "movie" && data.tmdbId) {
      const apiKey = process.env.TMDB_API_KEY
      if (!apiKey) throw new Error("Movie covers need TMDB_API_KEY.")
      const postersFor = async (includeImageLanguage?: string) => {
        const url = new URL(`https://api.themoviedb.org/3/movie/${data.tmdbId}/images`)
        url.searchParams.set("api_key", apiKey)
        if (includeImageLanguage) url.searchParams.set("include_image_language", includeImageLanguage)
        const response = await fetch(url)
        if (!response.ok) throw new Error("TMDB could not load poster options.")
        const body = (await response.json()) as { posters?: Array<{ file_path?: string }> }
        return body.posters ?? []
      }
      let posters = await postersFor("en,null")
      if (!posters.length) posters = await postersFor()
      return [...new Set(posters.flatMap((poster) => poster.file_path ? [`https://image.tmdb.org/t/p/w500${poster.file_path}`] : []))].slice(0, 18)
    }
    return []
  })

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
    await ensureDatabase()
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
    await ensureDatabase()
    const [item] = await db.select().from(items).where(eq(items.slug, data.slug))
    return item ?? null
  })

export const getItemById = createServerFn({ method: "GET" })
  .validator(z.object({ id: z.number().int() }))
  .handler(async ({ data }) => {
    requireAdmin()
    await ensureDatabase()
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
    await ensureDatabase()
    const now = new Date().toISOString()
    const coverImageUrl = await storeCover(data.coverImageUrl ?? "", data.slug)
    const values = {
      ...data,
      coverImageUrl: coverImageUrl || null,
      openLibraryKey: data.openLibraryKey || null,
      tmdbId: data.tmdbId || null,
      borrower: data.borrower?.trim() || null,
      loanedAt: data.loanedAt || null,
      format: data.format?.trim() || null,
      notes: "",
      acquiredAt: null,
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
    await ensureDatabase()
    await db.delete(items).where(eq(items.id, data.id))
    return { ok: true }
  })

export const login = createServerFn({ method: "POST" })
  .validator(z.object({ password: z.string() }))
  .handler(async ({ data }) => {
    const { startAdminSession, verifyPassword } = await import("./auth")
    if (!process.env.ADMIN_PASSWORD) {
      return { ok: false, error: "Admin access is not configured. Set ADMIN_PASSWORD to enable it." }
    }
    if (!verifyPassword(data.password)) return { ok: false, error: "That password doesn’t open this shelf." }
    startAdminSession()
    return { ok: true, error: "" }
  })

export const logout = createServerFn({ method: "POST" }).handler(async () => {
  const { endAdminSession } = await import("./auth")
  endAdminSession()
  return { ok: true }
})
