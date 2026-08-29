import { and, asc, eq, isNull, like, or } from "drizzle-orm"
import { createServerFn } from "@tanstack/react-start"
import { getRequestHeader } from "@tanstack/react-start/server"
import { z } from "zod"
import { db, ensureDatabase } from "./db"
import { isAgentToken, requireAdmin } from "./auth"
import { storeCover } from "./covers"
import {
  items,
  itemEditions,
  itemStatuses,
  itemTypes,
  listItems,
  lists,
  type Item,
} from "./schema"

export const bookGenreOptions = [
  "Fiction",
  "Nonfiction",
  "Science Fiction",
  "Fantasy",
  "Mystery",
  "Romance",
  "History",
  "Biography",
  "Young Adult",
  "Poetry",
  "Comics",
] as const
export const screenGenreOptions = [
  "Action",
  "Adventure",
  "Animation",
  "Comedy",
  "Crime",
  "Documentary",
  "Drama",
  "Family",
  "Fantasy",
  "History",
  "Horror",
  "Mystery",
  "Romance",
  "Science Fiction",
  "Thriller",
  "War",
  "Western",
] as const

const itemInput = z
  .object({
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
    format: z
      .enum(["hardcover", "paperback", "blu-ray", "dvd", "other"])
      .optional()
      .or(z.literal("")),
    edition: z.enum(itemEditions).optional().or(z.literal("")),
    genres: z.array(z.string().max(60)).max(20).default([]),
  })
  .superRefine((item, context) => {
    if (item.type !== "book" && item.status === "reading") {
      context.addIssue({
        code: "custom",
        message: "Only books can have Reading status.",
        path: ["status"],
      })
    }
    if (item.status === "borrowed" && !item.borrower?.trim()) {
      context.addIssue({
        code: "custom",
        message: "Borrowed items need a borrower.",
        path: ["borrower"],
      })
    }
    if (item.status !== "borrowed" && (item.borrower || item.loanedAt)) {
      context.addIssue({
        code: "custom",
        message: "Loan details only apply to borrowed items.",
        path: ["status"],
      })
    }
    if (
      item.type === "book" &&
      ["blu-ray", "dvd"].includes(item.format ?? "")
    ) {
      context.addIssue({
        code: "custom",
        message: "Choose a book format.",
        path: ["format"],
      })
    }
    if (
      (item.type === "movie" || item.type === "tv") &&
      ["hardcover", "paperback"].includes(item.format ?? "")
    ) {
      context.addIssue({
        code: "custom",
        message: "Choose a movie format.",
        path: ["format"],
      })
    }
    if (item.type === "book" && item.edition) {
      context.addIssue({
        code: "custom",
        message: "Only movies and TV shows can have an edition.",
        path: ["edition"],
      })
    }
  })

export type ItemInput = z.infer<typeof itemInput>

const lookupInput = z.object({
  query: z.string().trim().min(2).max(160),
  type: z.enum(itemTypes),
})

export const importItems = createServerFn({ method: "POST" })
  .validator(
    z.object({
      type: z.enum(itemTypes),
      format: z
        .enum(["hardcover", "paperback", "blu-ray", "dvd", "other"])
        .optional()
        .or(z.literal("")),
      edition: z.enum(itemEditions).optional().or(z.literal("")),
      queries: z.array(z.string().trim().min(1).max(200)).min(1).max(80),
    })
  )
  .handler(async ({ data }) => {
    if (!isAgentToken(getRequestHeader("authorization"))) requireAdmin()
    await ensureDatabase()
    const added: Array<{ title: string; slug: string }> = []
    const skipped: Array<{ query: string; reason: string }> = []
    const failed: Array<{ query: string; reason: string }> = []
    for (const query of data.queries) {
      try {
        const matches = await lookupCollection({ type: data.type, query })
        const match = matches[0]
        if (!match) {
          skipped.push({ query, reason: "No match found" })
          continue
        }
        const resolved =
          data.type !== "book"
            ? await getCollectionResultById({ type: data.type, id: match.id })
            : { ...match, slug: slugify(match.title) }
        if (
          await itemExists({
            type: data.type,
            title: resolved.title,
            year: resolved.year ?? 0,
            providerId: match.id,
            edition: data.edition,
          })
        ) {
          skipped.push({ query, reason: "Already on Shelf" })
          continue
        }
        const slug = await uniqueSlug(resolved.slug, data.edition)
        const now = new Date().toISOString()
        await db.insert(items).values({
          slug,
          type: data.type,
          status: "owned",
          title: resolved.title,
          creator: resolved.creator,
          year: resolved.year ?? 0,
          coverImageUrl:
            (await storeCover(resolved.coverImageUrl, resolved.slug)) || null,
          openLibraryKey: data.type === "book" ? match.id : null,
          tmdbId: data.type === "book" ? null : match.id,
          format: data.format || null,
          edition: normalizeEdition(data.edition),
          notes: "",
          acquiredAt: null,
          createdAt: now,
          updatedAt: now,
        })
        added.push({ title: resolved.title, slug })
      } catch (cause) {
        failed.push({
          query,
          reason: cause instanceof Error ? cause.message : "Import failed",
        })
      }
    }
    return { added, skipped, failed }
  })

export type LookupResult = {
  id: string
  type: "book" | "movie" | "tv"
  title: string
  creator: string
  year: number | null
  coverImageUrl: string
  genres: string[]
}

export async function lookupCollection(data: {
  query: string
  type: "book" | "movie" | "tv"
}): Promise<LookupResult[]> {
  if (data.type === "book") {
    const url = new URL("https://openlibrary.org/search.json")
    url.searchParams.set("q", data.query)
    url.searchParams.set(
      "fields",
      "key,title,author_name,first_publish_year,cover_i"
    )
    url.searchParams.set("limit", "6")
    const response = await fetch(url, {
      headers: { "User-Agent": "Shelf (https://github.com/ryanleichty/shelf)" },
    })
    if (!response.ok)
      throw new Error("Open Library could not complete that search.")
    const body = (await response.json()) as {
      docs?: Array<{
        key?: string
        title?: string
        author_name?: string[]
        first_publish_year?: number
        cover_i?: number
        subject?: string[]
      }>
    }
    return (body.docs ?? []).flatMap((book) =>
      book.key && book.title
        ? [
            {
              id: book.key,
              type: "book" as const,
              title: book.title,
              creator: book.author_name?.[0] ?? "Unknown author",
              year: book.first_publish_year ?? null,
              coverImageUrl: book.cover_i
                ? `https://covers.openlibrary.org/b/id/${book.cover_i}-L.jpg`
                : "",
              genres: curatedBookGenres(book.subject),
            },
          ]
        : []
    )
  }
  const apiKey = process.env.TMDB_API_KEY
  if (!apiKey)
    throw new Error(
      "Movie search needs TMDB_API_KEY. Add a free TMDB API key to your environment."
    )
  const url = new URL(
    `https://api.themoviedb.org/3/search/${data.type === "tv" ? "tv" : "movie"}`
  )
  url.searchParams.set("query", data.query)
  url.searchParams.set("include_adult", "false")
  url.searchParams.set("language", "en-US")
  url.searchParams.set("api_key", apiKey)
  const response = await fetch(url)
  if (!response.ok)
    throw new Error("TMDB could not complete that search. Check TMDB_API_KEY.")
  const body = (await response.json()) as {
    results?: Array<{
      id: number
      title?: string
      name?: string
      release_date?: string
      first_air_date?: string
      poster_path?: string | null
      genre_ids?: number[]
    }>
  }
  return (body.results ?? []).flatMap((movie) =>
    (movie.title ?? movie.name)
      ? [
          {
            id: String(movie.id),
            type: data.type,
            title: movie.title ?? movie.name!,
            creator:
              data.type === "tv"
                ? "Creator unavailable"
                : "Director unavailable",
            year:
              (movie.release_date ?? movie.first_air_date)
                ? Number(
                    (movie.release_date ?? movie.first_air_date)!.slice(0, 4)
                  )
                : null,
            coverImageUrl: movie.poster_path
              ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
              : "",
            genres: [],
          },
        ]
      : []
  )
}

export const getCoverOptions = createServerFn({ method: "GET" })
  .validator(
    z.object({
      type: z.enum(itemTypes),
      openLibraryKey: z.string().optional(),
      tmdbId: z.string().optional(),
    })
  )
  .handler(async ({ data }): Promise<string[]> => {
    requireAdmin()
    if (data.type === "book" && data.openLibraryKey) {
      const workId = data.openLibraryKey.replace(/^\/?works\//, "")
      const response = await fetch(
        `https://openlibrary.org/works/${workId}/editions.json?limit=100`,
        {
          headers: {
            "User-Agent": "Shelf (https://github.com/ryanleichty/shelf)",
          },
        }
      )
      if (!response.ok)
        throw new Error("Open Library could not load edition covers.")
      const body = (await response.json()) as {
        entries?: Array<{
          covers?: number[]
          languages?: Array<{ key?: string }>
        }>
      }
      const editions = body.entries ?? []
      const allCovers = [
        ...new Set(editions.flatMap((edition) => edition.covers ?? [])),
      ]
      const englishCovers = [
        ...new Set(
          editions
            .filter((edition) =>
              edition.languages?.some((language) =>
                language.key?.endsWith("/eng")
              )
            )
            .flatMap((edition) => edition.covers ?? [])
        ),
      ]
      const covers = (englishCovers.length ? englishCovers : allCovers).slice(
        0,
        18
      )
      return covers.map(
        (id) => `https://covers.openlibrary.org/b/id/${id}-L.jpg`
      )
    }
    if ((data.type === "movie" || data.type === "tv") && data.tmdbId) {
      const apiKey = process.env.TMDB_API_KEY
      if (!apiKey) throw new Error("Movie covers need TMDB_API_KEY.")
      const postersFor = async (includeImageLanguage?: string) => {
        const url = new URL(
          `https://api.themoviedb.org/3/${data.type}/${data.tmdbId}/images`
        )
        url.searchParams.set("api_key", apiKey)
        if (includeImageLanguage)
          url.searchParams.set("include_image_language", includeImageLanguage)
        const response = await fetch(url)
        if (!response.ok) throw new Error("TMDB could not load poster options.")
        const body = (await response.json()) as {
          posters?: Array<{ file_path?: string }>
        }
        return body.posters ?? []
      }
      let posters = await postersFor("en,null")
      if (!posters.length) posters = await postersFor()
      return [
        ...new Set(
          posters.flatMap((poster) =>
            poster.file_path
              ? [`https://image.tmdb.org/t/p/w500${poster.file_path}`]
              : []
          )
        ),
      ].slice(0, 18)
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

const normalizeEdition = (edition?: string | null) => edition?.trim() || null

export async function itemExists({
  id,
  type,
  title,
  year,
  providerId,
  edition,
}: {
  id?: number
  type: Item["type"]
  title: string
  year: number
  providerId?: string | null
  edition?: string | null
}) {
  const editionWhere = normalizeEdition(edition)
    ? eq(items.edition, normalizeEdition(edition)!)
    : or(isNull(items.edition), eq(items.edition, ""))
  const candidates = await db
    .select({
      id: items.id,
      title: items.title,
      year: items.year,
      tmdbId: items.tmdbId,
      openLibraryKey: items.openLibraryKey,
    })
    .from(items)
    .where(and(eq(items.type, type), editionWhere))
  return candidates.some(
    (item) =>
      item.id !== id &&
      ((providerId &&
        (type === "book" ? item.openLibraryKey : item.tmdbId) === providerId) ||
        (normalizeTitle(item.title) === normalizeTitle(title) &&
          item.year === year))
  )
}

export async function uniqueSlug(
  baseSlug: string,
  edition?: string | null,
  excludeId?: number
) {
  const base = await db
    .select({ id: items.id })
    .from(items)
    .where(eq(items.slug, baseSlug))
    .limit(1)
  if (!base.length || base[0].id === excludeId) return baseSlug
  const preferred = normalizeEdition(edition)
    ? `${baseSlug}-${normalizeEdition(edition)}`
    : baseSlug
  const existing = await db
    .select({ id: items.id })
    .from(items)
    .where(eq(items.slug, preferred))
    .limit(1)
  if (!existing.length || existing[0].id === excludeId) return preferred
  for (let suffix = 2; ; suffix++) {
    const slug = `${preferred}-${suffix}`
    const collision = await db
      .select({ id: items.id })
      .from(items)
      .where(eq(items.slug, slug))
      .limit(1)
    if (!collision.length || collision[0].id === excludeId) return slug
  }
}

export const normalizeTitle = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]/g, "")

export const searchCollection = createServerFn({ method: "GET" })
  .validator(lookupInput)
  .handler(async ({ data }): Promise<LookupResult[]> => {
    if (!isAgentToken(getRequestHeader("authorization"))) requireAdmin()
    return lookupCollection(data)
  })

export const getCollectionResult = createServerFn({ method: "GET" })
  .validator(z.object({ id: z.string().min(1), type: z.enum(itemTypes) }))
  .handler(async ({ data }): Promise<LookupResult & { slug: string }> => {
    if (!isAgentToken(getRequestHeader("authorization"))) requireAdmin()
    return getCollectionResultById(data)
  })

export function normalizeOpenLibraryWorkKey(key: string) {
  const workId = key.trim().replace(/^\/?works\//, "").replace(/^\//, "")
  return `/works/${workId}`
}

export async function getCollectionResultById(data: {
  id: string
  type: "book" | "movie" | "tv"
}): Promise<LookupResult & { slug: string }> {
  if (data.type === "book") {
    const id = normalizeOpenLibraryWorkKey(data.id)
    const response = await fetch(`https://openlibrary.org${id}.json`, {
      headers: { "User-Agent": "Shelf (https://github.com/ryanleichty/shelf)" },
    })
    if (response.status === 404)
      throw new Error(`Provider 404: Open Library work ${id} was not found.`)
    if (!response.ok) throw new Error(`Open Library could not load ${id}.`)
    const book = (await response.json()) as {
      title?: string
      first_publish_date?: string
      subjects?: string[]
    }
    const title = book.title ?? "Untitled"
    return {
      id,
      type: "book",
      title,
      creator: "Unknown author",
      year: yearFromDate(book.first_publish_date),
      coverImageUrl: "",
      genres: curatedBookGenres(book.subjects),
      slug: slugify(title),
    }
  }

  const apiKey = process.env.TMDB_API_KEY
  if (!apiKey)
    throw new Error(
      "TMDB lookup needs TMDB_API_KEY. Add a free TMDB API key to your environment."
    )
  const url = new URL(`https://api.themoviedb.org/3/${data.type}/${data.id}`)
  url.searchParams.set("append_to_response", "credits")
  url.searchParams.set("api_key", apiKey)
  const response = await fetch(url)
  if (response.status === 404)
    throw new Error(`Provider 404: TMDB ${data.type} ${data.id} was not found.`)
  if (!response.ok) throw new Error(`TMDB could not load ${data.type} ${data.id}.`)
  const result = (await response.json()) as {
    title?: string
    name?: string
    release_date?: string
    first_air_date?: string
    poster_path?: string | null
    genres?: Array<{ name?: string }>
    created_by?: Array<{ name?: string }>
    credits?: { crew?: Array<{ job?: string; name?: string }> }
  }
  const title =
    data.type === "tv"
      ? (result.name ?? "Untitled")
      : (result.title ?? "Untitled")
  const creator =
    data.type === "tv"
      ? (result.created_by?.[0]?.name ??
        result.credits?.crew?.find(
          (person) => person.job === "Creator" || person.job === "Director"
        )?.name ??
        "Creator unavailable")
      : (result.credits?.crew?.find((person) => person.job === "Director")
          ?.name ?? "Director unavailable")
  return {
    id: data.id,
    type: data.type,
    title,
    creator,
    year: yearFromDate(
      data.type === "tv" ? result.first_air_date : result.release_date
    ),
    coverImageUrl: result.poster_path
      ? `https://image.tmdb.org/t/p/w500${result.poster_path}`
      : "",
    genres:
      result.genres?.flatMap((genre) => (genre.name ? [genre.name] : [])) ?? [],
    slug: slugify(title),
  }
}

type SyncedFields = {
  title?: string
  creator?: string
  year?: number
  genres?: string[]
}

export type ProviderSyncResult = {
  itemId: number
  slug: string
  skipped?: string
  changes?: Partial<
    Record<
      keyof SyncedFields,
      { before: string | number | string[]; after: string | number | string[] }
    >
  >
}

export async function syncItemFromProvider(
  item: Item,
  dryRun = false
): Promise<ProviderSyncResult> {
  const providerId = item.type === "book" ? item.openLibraryKey : item.tmdbId
  if (!providerId)
    return {
      itemId: item.id,
      slug: item.slug,
      skipped: `Missing ${item.type === "book" ? "Open Library key" : "TMDB ID"}.`,
    }

  const metadata =
    item.type === "book"
      ? await getBookSyncMetadata(providerId)
      : await getTmdbSyncMetadata(item.type, providerId)

  const changes = changedFields(item, metadata)
  if (!Object.keys(changes).length)
    return { itemId: item.id, slug: item.slug, skipped: "Already up to date." }
  if (!dryRun) {
    await db
      .update(items)
      .set({
        ...Object.fromEntries(
          Object.entries(changes).map(([field, change]) => [
            field,
            change.after,
          ])
        ),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(items.id, item.id))
  }
  return { itemId: item.id, slug: item.slug, changes }
}

export const syncItem = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.number().int() }))
  .handler(async ({ data }) => {
    requireAdmin()
    await ensureDatabase()
    const [item] = await db.select().from(items).where(eq(items.id, data.id))
    if (!item) throw new Error("Item not found.")
    return syncItemFromProvider(item)
  })

async function getTmdbSyncMetadata(
  type: "movie" | "tv",
  tmdbId: string
): Promise<SyncedFields> {
  const apiKey = process.env.TMDB_API_KEY
  if (!apiKey) throw new Error("TMDB sync needs TMDB_API_KEY.")
  const url = new URL(`https://api.themoviedb.org/3/${type}/${tmdbId}`)
  url.searchParams.set("append_to_response", "credits")
  url.searchParams.set("api_key", apiKey)
  const response = await fetch(url)
  if (response.status === 404)
    throw new Error(`Provider 404: TMDB ${type} ${tmdbId} was not found.`)
  if (!response.ok) throw new Error(`TMDB could not load ${type} ${tmdbId}.`)
  const result = (await response.json()) as {
    title?: string
    name?: string
    release_date?: string
    first_air_date?: string
    genres?: Array<{ name?: string }>
    created_by?: Array<{ name?: string }>
    credits?: { crew?: Array<{ job?: string; name?: string }> }
  }
  const creator =
    type === "tv"
      ? (result.created_by?.[0]?.name ??
        result.credits?.crew?.find(
          (person) => person.job === "Creator" || person.job === "Director"
        )?.name)
      : result.credits?.crew?.find((person) => person.job === "Director")?.name
  return {
    ...(type === "tv"
      ? result.name
        ? { title: result.name }
        : {}
      : result.title
        ? { title: result.title }
        : {}),
    ...(creator ? { creator } : {}),
    ...(yearFromDate(
      type === "tv" ? result.first_air_date : result.release_date
    ) !== null
      ? {
          year: yearFromDate(
            type === "tv" ? result.first_air_date : result.release_date
          )!,
        }
      : {}),
    genres:
      result.genres?.flatMap((genre) => (genre.name ? [genre.name] : [])) ?? [],
  }
}

async function getBookSyncMetadata(
  openLibraryKey: string
): Promise<SyncedFields> {
  const response = await fetch(
    `https://openlibrary.org${openLibraryKey}.json`,
    {
      headers: { "User-Agent": "Shelf (https://github.com/ryanleichty/shelf)" },
    }
  )
  if (response.status === 404)
    throw new Error(
      `Provider 404: Open Library work ${openLibraryKey} was not found.`
    )
  if (!response.ok)
    throw new Error(`Open Library could not load ${openLibraryKey}.`)
  const book = (await response.json()) as {
    title?: string
    first_publish_date?: string
    subjects?: string[]
    authors?: Array<{ author?: { key?: string }; name?: string }>
  }
  const authorNames = (
    await Promise.all(
      (book.authors ?? []).map(async (author) => {
        if (author.name) return author.name
        if (!author.author?.key) return undefined
        const authorResponse = await fetch(
          `https://openlibrary.org${author.author.key}.json`,
          {
            headers: {
              "User-Agent": "Shelf (https://github.com/ryanleichty/shelf)",
            },
          }
        )
        if (!authorResponse.ok) return undefined
        return ((await authorResponse.json()) as { name?: string }).name
      })
    )
  ).flatMap((name) => (name ? [name] : []))
  const year = yearFromDate(book.first_publish_date)
  return {
    ...(book.title ? { title: book.title } : {}),
    ...(authorNames.length ? { creator: authorNames.join(", ") } : {}),
    ...(year !== null ? { year } : {}),
    genres: curatedBookGenres(book.subjects),
  }
}

function changedFields(
  item: Item,
  metadata: SyncedFields
): NonNullable<ProviderSyncResult["changes"]> {
  const changes: NonNullable<ProviderSyncResult["changes"]> = {}
  for (const field of ["title", "creator", "year", "genres"] as const) {
    const next = metadata[field]
    if (next === undefined) continue
    const previous = item[field]
    if (JSON.stringify(previous) !== JSON.stringify(next))
      changes[field] = { before: previous, after: next }
  }
  return changes
}

function curatedBookGenres(subjects?: string[]) {
  const subjectSet = new Set(
    (subjects ?? []).map((subject) => subject.toLocaleLowerCase())
  )
  return bookGenreOptions.filter((genre) =>
    subjectSet.has(genre.toLocaleLowerCase())
  )
}

function yearFromDate(value?: string) {
  const match = value?.match(/\b(\d{4})\b/)
  return match ? Number(match[1]) : null
}

export const getItems = createServerFn({ method: "GET" })
  .validator(
    z
      .object({
        type: z.enum(itemTypes).optional(),
        query: z.string().max(100).optional(),
      })
      .optional()
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

const listMembershipInput = z.object({
  itemId: z.number().int(),
  listSlug: z.string().min(1).max(120),
})

export const addItemToList = createServerFn({ method: "POST" })
  .validator(listMembershipInput)
  .handler(async ({ data }) => {
    requireAdmin()
    await ensureDatabase()
    const [list] = await db
      .select()
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
  .validator(listMembershipInput)
  .handler(async ({ data }) => {
    requireAdmin()
    await ensureDatabase()
    const [list] = await db
      .select()
      .from(lists)
      .where(eq(lists.slug, data.listSlug))
      .limit(1)
    if (!list) return { ok: true }
    await db
      .delete(listItems)
      .where(and(eq(listItems.listId, list.id), eq(listItems.itemId, data.itemId)))
    return { ok: true }
  })

export const getHomeRows = createServerFn({ method: "GET" }).handler(
  async () => {
    await ensureDatabase()
    const allItems = await db.select().from(items).orderBy(asc(items.title))
    const memberships = await db
      .select({
        listSlug: lists.slug,
        itemId: listItems.itemId,
        position: listItems.position,
      })
      .from(listItems)
      .innerJoin(lists, eq(listItems.listId, lists.id))
      .orderBy(asc(listItems.position))

    const rows: Array<{ title: string; items: Item[] }> = []
    for (const [slug, title, allowedTypes] of [
      ["watchlist", "Watchlist", ["movie", "tv"]],
      ["reading-list", "Reading list", ["book"]],
    ] as const) {
      const itemIds = new Set(
        memberships
          .filter(
            (membership) =>
              membership.listSlug === slug &&
              allowedTypes.includes(
                allItems.find((item) => item.id === membership.itemId)?.type ??
                  "book"
              )
          )
          .map((membership) => membership.itemId)
      )
      const rowItems = allItems.filter((item) => itemIds.has(item.id))
      if (rowItems.length) rows.push({ title, items: rowItems })
    }

    const genres = new Map<string, Item[]>()
    for (const item of allItems) {
      for (const genre of item.genres) {
        const name = genre.trim()
        if (!name) continue
        genres.set(name, [...(genres.get(name) ?? []), item])
      }
    }
    return [
      ...rows,
      ...[...genres.entries()]
        .sort(([leftName, leftItems], [rightName, rightItems]) =>
          rightItems.length - leftItems.length || leftName.localeCompare(rightName)
        )
        .map(([title, rowItems]) => ({ title, items: rowItems })),
    ]
  }
)

export const getItemBySlug = createServerFn({ method: "GET" })
  .validator(z.object({ slug: z.string() }))
  .handler(async ({ data }) => {
    await ensureDatabase()
    const [item] = await db
      .select()
      .from(items)
      .where(eq(items.slug, data.slug))
    if (!item) return null
    const listSlug = item.type === "book" ? "reading-list" : "watchlist"
    const [list] = await db
      .select()
      .from(lists)
      .where(eq(lists.slug, listSlug))
      .limit(1)
    const [membership] = list
      ? await db
          .select({ id: listItems.id })
          .from(listItems)
          .where(
            and(eq(listItems.listId, list.id), eq(listItems.itemId, item.id))
          )
          .limit(1)
      : []
    return {
      ...item,
      targetList: {
        slug: listSlug,
        name: list?.name ?? (item.type === "book" ? "Reading list" : "Watchlist"),
        containsItem: Boolean(membership),
      },
    }
  })

export const getItemById = createServerFn({ method: "GET" })
  .validator(z.object({ id: z.number().int() }))
  .handler(async ({ data }) => {
    requireAdmin()
    await ensureDatabase()
    const [item] = await db.select().from(items).where(eq(items.id, data.id))
    return item ?? null
  })

export const getAdminStatus = createServerFn({ method: "GET" }).handler(
  async () => {
    const { isAdmin } = await import("./auth")
    return isAdmin()
  }
)

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
      edition: normalizeEdition(data.edition),
      notes: "",
      acquiredAt: null,
      updatedAt: now,
    }
    if (data.id) {
      if (
        await itemExists({
          id: data.id,
          type: data.type,
          title: data.title,
          year: data.year,
          providerId: data.type === "book" ? data.openLibraryKey : data.tmdbId,
          edition: data.edition,
        })
      ) {
        throw new Error("This edition is already on your shelf.")
      }
      await db.update(items).set(values).where(eq(items.id, data.id))
      return { id: data.id, slug: data.slug }
    }
    if (
      await itemExists({
        type: data.type,
        title: data.title,
        year: data.year,
        providerId: data.type === "book" ? data.openLibraryKey : data.tmdbId,
        edition: data.edition,
      })
    ) {
      throw new Error("This edition is already on your shelf.")
    }
    values.slug = await uniqueSlug(data.slug, data.edition)
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
    await db.delete(listItems).where(eq(listItems.itemId, data.id))
    await db.delete(items).where(eq(items.id, data.id))
    return { ok: true }
  })

export const login = createServerFn({ method: "POST" })
  .validator(z.object({ password: z.string() }))
  .handler(async ({ data }) => {
    const { startAdminSession, verifyPassword } = await import("./auth")
    if (!process.env.ADMIN_PASSWORD) {
      return {
        ok: false,
        error:
          "Admin access is not configured. Set ADMIN_PASSWORD to enable it.",
      }
    }
    if (!verifyPassword(data.password))
      return { ok: false, error: "That password doesn’t open this shelf." }
    try {
      startAdminSession()
    } catch {
      return {
        ok: false,
        error: "Couldn’t start a session. Check SESSION_SECRET / ADMIN_PASSWORD.",
      }
    }
    return { ok: true, error: "" }
  })

export const logout = createServerFn({ method: "POST" }).handler(async () => {
  const { endAdminSession } = await import("./auth")
  endAdminSession()
  return { ok: true }
})
