import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  lte,
  or,
  sql,
} from "drizzle-orm"
import { createServerFn } from "@tanstack/react-start"
import { getRequestHeader } from "@tanstack/react-start/server"
import { z } from "zod"
import { db, ensureDatabase, refreshSearchIndex } from "./db"
import { isAgentToken, requireAdmin, requireSignedIn } from "./auth"
import { storeCover } from "./covers"
import {
  items,
  actors,
  authors,
  collections,
  directors,
  itemActors,
  itemAuthors,
  itemCollections,
  itemDirectors,
  itemGenres,
  itemKeywords,
  genres,
  keywords,
  itemEditions,
  itemStatuses,
  itemTypes,
  listItems,
  listPlacements,
  lists,
  users,
  type Item,
  type ItemRecord,
  type Collection,
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
    creator: z.string().max(240).optional().default(""),
    authors: z.array(z.string().trim().min(1).max(240)).max(20).default([]),
    directors: z.array(z.string().trim().min(1).max(240)).max(20).default([]),
    actors: z.array(z.string().trim().min(1).max(240)).max(100).default([]),
    year: z.number().int().min(0).max(3000),
    coverImageUrl: z.string().url().optional().or(z.literal("")),
    openLibraryKey: z.string().max(120).optional().or(z.literal("")),
    tmdbId: z.string().max(40).optional().or(z.literal("")),
    barcode: z.string().max(80).optional().or(z.literal("")),
    borrower: z.string().max(120).optional().or(z.literal("")),
    loanedAt: z.string().date().optional().or(z.literal("")),
    format: z
      .enum(["hardcover", "paperback", "blu-ray", "dvd", "other"])
      .optional()
      .or(z.literal("")),
    edition: z.enum(itemEditions).optional().or(z.literal("")),
    genres: z.array(z.string().max(60)).max(20).default([]),
    description: z.string().max(10000).optional().or(z.literal("")),
  })
  .superRefine((item, context) => {
    const primaryPeople = item.type === "book" ? item.authors : item.directors
    if (!primaryPeople.length && !item.creator.trim()) {
      context.addIssue({
        code: "custom",
        message: `Add at least one ${item.type === "book" ? "author" : "director"}.`,
        path: [item.type === "book" ? "authors" : "directors"],
      })
    }
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

export type PersonOptions = {
  authors: string[]
  directors: string[]
  actors: string[]
}

const lookupInput = z.object({
  query: z.string().trim().min(2).max(160),
  type: z.enum(itemTypes),
})

export const importItems = createServerFn({ method: "POST" })
  .inputValidator(
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
    if (!isAgentToken(getRequestHeader("authorization")))
      await requireSignedIn()
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
        const providerResult = await getCollectionResultById({
          type: data.type,
          id: match.id,
        })
        const resolved = {
          ...providerResult,
          creator:
            providerResult.creator === "Unknown author"
              ? match.creator
              : providerResult.creator,
          coverImageUrl: providerResult.coverImageUrl || match.coverImageUrl,
        }
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
        const [created] = await db
          .insert(items)
          .values({
            slug,
            type: data.type,
            status: "owned",
            title: resolved.title,
            creator: resolved.creator,
            year: resolved.year ?? 0,
            coverImageUrl:
              (await storeCover(resolved.coverImageUrl, resolved.slug)) || null,
            backdropImageUrl: resolved.backdropImageUrl || null,
            openLibraryKey: data.type === "book" ? match.id : null,
            tmdbId: data.type === "book" ? null : match.id,
            format: data.format || null,
            edition: normalizeEdition(data.edition),
            certification: resolved.certification ?? null,
            runtime: resolved.runtime ?? null,
            notes: "",
            acquiredAt: null,
            createdAt: now,
            updatedAt: now,
          })
          .returning({ id: items.id })
        await replaceItemTags(created.id, {
          genres: resolved.genres,
          keywords: resolved.keywords,
        })
        await replaceItemCreators(created.id, data.type, resolved.creator)
        if (data.type !== "book" && resolved.cast !== undefined)
          await replaceItemCast(created.id, resolved.cast)
        if (data.type === "movie")
          await replaceItemCollection(created.id, resolved.collection ?? null)
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
  backdropImageUrl?: string
  genres: string[]
  description?: string
  keywords?: string[]
  cast?: string[]
  collection?: CollectionInput
  certification?: string
  runtime?: number
}

type CollectionInput = {
  tmdbCollectionId: string
  name: string
  overview?: string
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
  .inputValidator(
    z.object({
      type: z.enum(itemTypes),
      openLibraryKey: z.string().optional(),
      tmdbId: z.string().optional(),
    })
  )
  .handler(async ({ data }): Promise<string[]> => {
    await requireSignedIn()
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

type TagKind = "genre" | "keyword" | "author" | "director"

export async function upsertTags(
  itemId: number,
  kind: TagKind,
  names: string[]
) {
  const table =
    kind === "genre"
      ? genres
      : kind === "keyword"
        ? keywords
        : kind === "author"
          ? authors
          : directors
  const joins =
    kind === "genre"
      ? itemGenres
      : kind === "keyword"
        ? itemKeywords
        : kind === "author"
          ? itemAuthors
          : itemDirectors
  const normalized = [
    ...new Set(names.map((name) => name.trim()).filter(Boolean)),
  ]
  await db.delete(joins).where(eq(joins.itemId, itemId))
  for (const name of normalized) {
    const slug = slugify(name)
    if (!slug) continue
    await db
      .insert(table)
      .values({ slug, name })
      .onConflictDoNothing({ target: table.slug })
    const [tag] = await db
      .select({ id: table.id })
      .from(table)
      .where(eq(table.slug, slug))
    if (!tag) continue
    if (kind === "genre") {
      await db
        .insert(itemGenres)
        .values({ itemId, genreId: tag.id })
        .onConflictDoNothing()
    } else if (kind === "keyword") {
      await db
        .insert(itemKeywords)
        .values({ itemId, keywordId: tag.id })
        .onConflictDoNothing()
    } else if (kind === "author") {
      await db
        .insert(itemAuthors)
        .values({ itemId, authorId: tag.id })
        .onConflictDoNothing()
    } else {
      await db
        .insert(itemDirectors)
        .values({ itemId, directorId: tag.id })
        .onConflictDoNothing()
    }
  }
}

function parseCreatorNames(creator: string) {
  return creator
    .split(/,|\s+and\s+|\s+&\s+/i)
    .map((name) => name.trim())
    .filter(Boolean)
}

async function replaceItemCreators(
  itemId: number,
  type: Item["type"],
  creators: string | string[]
) {
  await upsertTags(
    itemId,
    type === "book" ? "author" : "director",
    typeof creators === "string" ? parseCreatorNames(creators) : creators
  )
}

export async function replaceItemCast(itemId: number, names: string[]) {
  const normalized = [
    ...new Set(names.map((name) => name.trim()).filter(Boolean)),
  ]
  await db.delete(itemActors).where(eq(itemActors.itemId, itemId))
  for (const [position, name] of normalized.entries()) {
    const slug = slugify(name)
    if (!slug) continue
    await db
      .insert(actors)
      .values({ slug, name })
      .onConflictDoNothing({ target: actors.slug })
    const [actor] = await db
      .select({ id: actors.id })
      .from(actors)
      .where(eq(actors.slug, slug))
    if (!actor) continue
    await db
      .insert(itemActors)
      .values({ itemId, actorId: actor.id, position })
      .onConflictDoNothing()
  }
}

async function replaceItemTags(
  itemId: number,
  tags: { genres?: string[]; keywords?: string[] }
) {
  if (tags.genres !== undefined) await upsertTags(itemId, "genre", tags.genres)
  if (tags.keywords !== undefined)
    await upsertTags(itemId, "keyword", tags.keywords)
  if (tags.genres !== undefined || tags.keywords !== undefined)
    await refreshSearchIndex()
}

export async function replaceItemCollection(
  itemId: number,
  collection: CollectionInput | null
) {
  await db.delete(itemCollections).where(eq(itemCollections.itemId, itemId))
  if (!collection) return

  const [existing] = await db
    .select({ id: collections.id })
    .from(collections)
    .where(eq(collections.tmdbCollectionId, collection.tmdbCollectionId))
    .limit(1)
  const collectionId =
    existing?.id ??
    (
      await db
        .insert(collections)
        .values({
          slug: await uniqueCollectionSlug(collection.name),
          name: collection.name,
          tmdbCollectionId: collection.tmdbCollectionId,
          overview: collection.overview || null,
        })
        .returning({ id: collections.id })
    )[0].id

  await db
    .insert(itemCollections)
    .values({ itemId, collectionId })
    .onConflictDoNothing()
}

async function uniqueCollectionSlug(name: string) {
  const baseSlug = slugify(name)
  for (let suffix = 1; ; suffix++) {
    const slug = suffix === 1 ? baseSlug : `${baseSlug}-${suffix}`
    const [existing] = await db
      .select({ id: collections.id })
      .from(collections)
      .where(eq(collections.slug, slug))
      .limit(1)
    if (!existing) return slug
  }
}

async function enrichItems(records: ItemRecord[]): Promise<Item[]> {
  if (!records.length) return []
  const itemIds = records.map((item) => item.id)
  const [
    genreRows,
    keywordRows,
    authorRows,
    directorRows,
    actorRows,
    collectionRows,
  ] = await Promise.all([
    db
      .select({ itemId: itemGenres.itemId, name: genres.name })
      .from(itemGenres)
      .innerJoin(genres, eq(itemGenres.genreId, genres.id))
      .where(inArray(itemGenres.itemId, itemIds)),
    db
      .select({ itemId: itemKeywords.itemId, name: keywords.name })
      .from(itemKeywords)
      .innerJoin(keywords, eq(itemKeywords.keywordId, keywords.id))
      .where(inArray(itemKeywords.itemId, itemIds)),
    db
      .select({ itemId: itemAuthors.itemId, name: authors.name })
      .from(itemAuthors)
      .innerJoin(authors, eq(itemAuthors.authorId, authors.id))
      .where(inArray(itemAuthors.itemId, itemIds)),
    db
      .select({ itemId: itemDirectors.itemId, name: directors.name })
      .from(itemDirectors)
      .innerJoin(directors, eq(itemDirectors.directorId, directors.id))
      .where(inArray(itemDirectors.itemId, itemIds)),
    db
      .select({
        itemId: itemActors.itemId,
        name: actors.name,
        position: itemActors.position,
      })
      .from(itemActors)
      .innerJoin(actors, eq(itemActors.actorId, actors.id))
      .where(inArray(itemActors.itemId, itemIds))
      .orderBy(asc(itemActors.position)),
    db
      .select({
        itemId: itemCollections.itemId,
        id: collections.id,
        slug: collections.slug,
        name: collections.name,
        tmdbCollectionId: collections.tmdbCollectionId,
        overview: collections.overview,
      })
      .from(itemCollections)
      .innerJoin(collections, eq(itemCollections.collectionId, collections.id))
      .where(inArray(itemCollections.itemId, itemIds)),
  ])
  const namesById = (rows: Array<{ itemId: number; name: string }>) => {
    const grouped = new Map<number, Array<{ itemId: number; name: string }>>()
    for (const row of rows)
      grouped.set(row.itemId, [...(grouped.get(row.itemId) ?? []), row])
    return grouped
  }
  const genreNames = namesById(genreRows)
  const keywordNames = namesById(keywordRows)
  const authorNames = namesById(authorRows)
  const directorNames = namesById(directorRows)
  const actorNames = namesById(actorRows)
  const collectionsByItem = new Map<number, Collection>(
    collectionRows.map(({ itemId, ...collection }) => [itemId, collection])
  )
  return records.map((item) => ({
    ...item,
    genres: (genreNames.get(item.id) ?? []).map((tag) => tag.name),
    keywords: (keywordNames.get(item.id) ?? []).map((tag) => tag.name),
    authors: (authorNames.get(item.id) ?? []).map((person) => person.name),
    directors: (directorNames.get(item.id) ?? []).map((person) => person.name),
    actors: (actorNames.get(item.id) ?? []).map((person) => person.name),
    ...(item.type === "movie" && collectionsByItem.has(item.id)
      ? { collection: collectionsByItem.get(item.id) }
      : {}),
  }))
}

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

const barcodeInput = z
  .string()
  .max(80)
  .transform((value) => value.replace(/\s/g, "").toUpperCase())
  .refine(
    (value) => /^\d{12,13}$/.test(value) || /^\d{9}[\dX]$/.test(value),
    "Enter an EAN-13, UPC-A, ISBN-10, or ISBN-13 code."
  )

type CheckResult =
  | { status: "owned"; item: ItemRecord }
  | { status: "not-owned"; title?: string; year?: number; format?: string }

type BarcodeResolution =
  | { status: "owned"; item: ItemRecord }
  | {
      status: "resolved"
      result: LookupResult
      format: ItemInput["format"]
    }

export const checkBarcode = createServerFn({ method: "POST" })
  .inputValidator(z.object({ code: barcodeInput }))
  .handler(async ({ data }): Promise<CheckResult> => {
    await requireAdmin()
    await ensureDatabase()

    const stored = await itemForBarcode(data.code)
    if (stored) return { status: "owned", item: stored }

    const book = await itemForIsbn(data.code)
    if (book) {
      await saveBarcode(book.id, data.code)
      return { status: "owned", item: book }
    }

    const disc = await lookupDiscBarcode(data.code)
    if (!disc) return { status: "not-owned" }

    const catalogItem = await itemForDisc(disc.title, disc.year)
    if (!catalogItem)
      return {
        status: "not-owned",
        title: disc.title,
        year: disc.year,
        format: disc.format,
      }

    await saveBarcode(catalogItem.id, data.code)
    return { status: "owned", item: catalogItem }
  })

export const resolveBarcode = createServerFn({ method: "POST" })
  .inputValidator(z.object({ code: barcodeInput, type: z.enum(itemTypes) }))
  .handler(async ({ data }): Promise<BarcodeResolution> => {
    await requireSignedIn()
    await ensureDatabase()

    const stored = await itemForBarcode(data.code)
    if (stored) return { status: "owned", item: stored }

    const book = await lookupBookBarcode(data.code)
    if (book) {
      const owned = await itemForBookWork(book.id)
      if (owned) return { status: "owned", item: owned }
      return { status: "resolved", result: book, format: "" }
    }

    const disc = await lookupDiscBarcode(data.code)
    if (!disc)
      throw new Error(
        "We couldn't look up that barcode. You can still complete the form manually."
      )

    const owned = await itemForDisc(disc.title, disc.year)
    if (owned) return { status: "owned", item: owned }

    const result = await lookupDiscResult(disc, data.type)
    if (!result)
      throw new Error(
        "We found the barcode but couldn't match it in the catalog. You can still complete the form manually."
      )
    return { status: "resolved", result, format: discFormat(disc.format) }
  })

async function itemForBarcode(barcode: string) {
  const [item] = await db
    .select()
    .from(items)
    .where(eq(items.barcode, barcode))
    .limit(1)
  return item
}

async function itemForIsbn(isbn: string) {
  const response = await fetch(`https://openlibrary.org/isbn/${isbn}.json`, {
    headers: { "User-Agent": "Shelf (https://github.com/ryanleichty/shelf)" },
  })
  if (response.status === 404) return null
  if (!response.ok) throw new Error("Open Library could not look up that ISBN.")
  const edition = (await response.json()) as {
    works?: Array<{ key?: string }>
  }
  const key = edition.works?.[0]?.key
  if (!key) return null
  const workKey = normalizeOpenLibraryWorkKey(key)
  return itemForBookWork(workKey)
}

async function itemForBookWork(workKey: string) {
  const [item] = await db
    .select()
    .from(items)
    .where(and(eq(items.type, "book"), eq(items.openLibraryKey, workKey)))
    .limit(1)
  return item
}

async function lookupBookBarcode(isbn: string): Promise<LookupResult | null> {
  const response = await fetch(`https://openlibrary.org/isbn/${isbn}.json`, {
    headers: { "User-Agent": "Shelf (https://github.com/ryanleichty/shelf)" },
  })
  if (response.status === 404) return null
  if (!response.ok) throw new Error("Open Library could not look up that ISBN.")
  const edition = (await response.json()) as {
    works?: Array<{ key?: string }>
    authors?: Array<{ key?: string; name?: string }>
    covers?: number[]
    publish_date?: string
  }
  const workKey = edition.works?.[0]?.key
  if (!workKey) return null

  const result = await getCollectionResultById({ id: workKey, type: "book" })
  const author = edition.authors?.[0]
  const authorName =
    author?.name ??
    (author?.key ? await lookupOpenLibraryAuthor(author.key) : "")
  return {
    ...result,
    creator: authorName || result.creator,
    year: yearFromDate(edition.publish_date) ?? result.year,
    coverImageUrl: edition.covers?.[0]
      ? `https://covers.openlibrary.org/b/id/${edition.covers[0]}-L.jpg`
      : result.coverImageUrl,
  }
}

async function lookupOpenLibraryAuthor(key: string) {
  const response = await fetch(`https://openlibrary.org${key}.json`, {
    headers: { "User-Agent": "Shelf (https://github.com/ryanleichty/shelf)" },
  })
  if (!response.ok) return ""
  const author = (await response.json()) as { name?: string }
  return author.name ?? ""
}

async function lookupDiscBarcode(barcode: string) {
  const apiKey = process.env.UPCMDB_API_KEY?.trim()
  if (!apiKey) return null
  const response = await fetch(`https://upcmdb.com/api/v1/lookup/${barcode}`, {
    headers: { "x-api-key": apiKey },
  })
  if (response.status === 404) return null
  if (!response.ok) throw new Error("UPCMDb could not look up that barcode.")
  const body = (await response.json()) as {
    status?: string
    data?: { title?: string; year?: string | number; format?: string }
  }
  const title = body.data?.title?.trim()
  const year =
    typeof body.data?.year === "number"
      ? body.data.year
      : Number(body.data?.year)
  if (body.status !== "success" || !title || !Number.isInteger(year))
    return null
  return { title, year, format: body.data?.format }
}

async function lookupDiscResult(
  disc: { title: string; year: number },
  currentType: Item["type"]
) {
  const types =
    currentType === "movie" || currentType === "tv"
      ? [currentType]
      : (["movie", "tv"] as const)
  const matches = (
    await Promise.all(
      types.map(async (type) => {
        const results = await lookupCollection({ query: disc.title, type })
        return results.find((result) => result.year === disc.year)
      })
    )
  ).filter((result): result is LookupResult => Boolean(result))
  return matches.length === 1 ? matches[0] : null
}

function discFormat(format?: string): ItemInput["format"] {
  const normalized = format?.toLowerCase() ?? ""
  if (normalized.includes("blu")) return "blu-ray"
  if (normalized.includes("dvd")) return "dvd"
  return ""
}

async function itemForDisc(title: string, year: number) {
  const candidates = await db
    .select()
    .from(items)
    .where(
      and(
        or(eq(items.type, "movie"), eq(items.type, "tv")),
        eq(items.year, year)
      )
    )
  return candidates.find(
    (item) => normalizeTitle(item.title) === normalizeTitle(title)
  )
}

async function saveBarcode(itemId: number, barcode: string) {
  await db
    .update(items)
    .set({ barcode, updatedAt: new Date().toISOString() })
    .where(eq(items.id, itemId))
}

export const searchCollection = createServerFn({ method: "GET" })
  .inputValidator(lookupInput)
  .handler(async ({ data }): Promise<LookupResult[]> => {
    if (!isAgentToken(getRequestHeader("authorization")))
      await requireSignedIn()
    return lookupCollection(data)
  })

export const getCollectionResult = createServerFn({ method: "GET" })
  .inputValidator(z.object({ id: z.string().min(1), type: z.enum(itemTypes) }))
  .handler(async ({ data }): Promise<LookupResult & { slug: string }> => {
    if (!isAgentToken(getRequestHeader("authorization")))
      await requireSignedIn()
    return getCollectionResultById(data)
  })

export function normalizeOpenLibraryWorkKey(key: string) {
  const workId = key
    .trim()
    .replace(/^\/?works\//, "")
    .replace(/^\//, "")
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
      description?: string | { value?: string }
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
      description: openLibraryDescription(book.description),
      slug: slugify(title),
    }
  }

  const apiKey = process.env.TMDB_API_KEY
  if (!apiKey)
    throw new Error(
      "TMDB lookup needs TMDB_API_KEY. Add a free TMDB API key to your environment."
    )
  const url = new URL(`https://api.themoviedb.org/3/${data.type}/${data.id}`)
  url.searchParams.set(
    "append_to_response",
    data.type === "tv"
      ? "aggregate_credits,keywords,content_ratings"
      : "credits,keywords,release_dates"
  )
  url.searchParams.set("api_key", apiKey)
  const response = await fetch(url)
  if (response.status === 404)
    throw new Error(`Provider 404: TMDB ${data.type} ${data.id} was not found.`)
  if (!response.ok)
    throw new Error(`TMDB could not load ${data.type} ${data.id}.`)
  const result = (await response.json()) as {
    title?: string
    name?: string
    release_date?: string
    first_air_date?: string
    poster_path?: string | null
    backdrop_path?: string | null
    overview?: string
    runtime?: number
    episode_run_time?: number[]
    genres?: Array<{ name?: string }>
    keywords?: {
      keywords?: Array<{ name?: string }>
      results?: Array<{ name?: string }>
    }
    belongs_to_collection?: {
      id?: number
      name?: string
      overview?: string
    } | null
    created_by?: Array<{ name?: string }>
    credits?: {
      cast?: Array<{ name?: string; order?: number }>
      crew?: Array<{ job?: string; name?: string }>
    }
    aggregate_credits?: {
      cast?: Array<{
        name?: string
        order?: number
        roles?: Array<{ character?: string }>
      }>
    }
    release_dates?: {
      results?: Array<{
        iso_3166_1?: string
        release_dates?: Array<{ certification?: string; type?: number }>
      }>
    }
    content_ratings?: {
      results?: Array<{ iso_3166_1?: string; rating?: string }>
    }
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
    backdropImageUrl: result.backdrop_path
      ? `https://image.tmdb.org/t/p/w1280${result.backdrop_path}`
      : undefined,
    genres:
      result.genres?.flatMap((genre) => (genre.name ? [genre.name] : [])) ?? [],
    description: result.overview ?? "",
    keywords:
      (data.type === "tv"
        ? result.keywords?.results
        : result.keywords?.keywords
      )?.flatMap((keyword) => (keyword.name ? [keyword.name] : [])) ?? [],
    ...(tmdbCast(data.type, result) !== undefined
      ? { cast: tmdbCast(data.type, result) }
      : {}),
    ...(data.type === "movie"
      ? { collection: tmdbCollection(result.belongs_to_collection) }
      : {}),
    ...tmdbScreenMetadata(data.type, result),
    slug: slugify(title),
  }
}

function tmdbCollection(
  collection?: { id?: number; name?: string; overview?: string } | null
): CollectionInput | undefined {
  if (typeof collection?.id !== "number" || !collection.name) return undefined
  return {
    tmdbCollectionId: String(collection.id),
    name: collection.name,
    overview: collection.overview,
  }
}

function tmdbCast(
  type: "movie" | "tv",
  result: {
    credits?: { cast?: Array<{ name?: string; order?: number }> }
    aggregate_credits?: {
      cast?: Array<{
        name?: string
        order?: number
        roles?: Array<{ character?: string }>
      }>
    }
  }
): string[] | undefined {
  const cast =
    type === "movie" ? result.credits?.cast : result.aggregate_credits?.cast
  if (!cast) return undefined
  return cast
    .map((person, index) => ({
      name: person.name?.trim(),
      order: person.order ?? index,
    }))
    .filter((person): person is { name: string; order: number } =>
      Boolean(person.name)
    )
    .sort((a, b) => a.order - b.order)
    .map((person) => person.name)
}

function tmdbScreenMetadata(
  type: "movie" | "tv",
  result: {
    runtime?: number
    episode_run_time?: number[]
    release_dates?: {
      results?: Array<{
        iso_3166_1?: string
        release_dates?: Array<{ certification?: string; type?: number }>
      }>
    }
    content_ratings?: {
      results?: Array<{ iso_3166_1?: string; rating?: string }>
    }
  }
): { certification?: string; runtime?: number } {
  const certification =
    type === "movie"
      ? tmdbMovieUsCertification(result.release_dates)
      : tmdbTvUsCertification(result.content_ratings)
  const runtime =
    type === "movie"
      ? validRuntime(result.runtime)
      : result.episode_run_time?.map(validRuntime).find(Boolean)

  return {
    certification,
    runtime,
  }
}

function tmdbMovieUsCertification(releaseDates?: {
  results?: Array<{
    iso_3166_1?: string
    release_dates?: Array<{ certification?: string; type?: number }>
  }>
}): string | undefined {
  const releases = releaseDates?.results?.find(
    (country) => country.iso_3166_1 === "US"
  )?.release_dates
  const theatrical = releases?.find(
    (release) => release.type === 3 && release.certification?.trim()
  )
  return (
    theatrical?.certification?.trim() ??
    releases
      ?.find((release) => release.certification?.trim())
      ?.certification?.trim()
  )
}

function tmdbTvUsCertification(contentRatings?: {
  results?: Array<{ iso_3166_1?: string; rating?: string }>
}): string | undefined {
  return contentRatings?.results
    ?.find((country) => country.iso_3166_1 === "US")
    ?.rating?.trim()
}

function validRuntime(value: number | undefined) {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : undefined
}

type SyncedFields = {
  title?: string
  creator?: string
  year?: number
  genres?: string[]
  description?: string
  keywords?: string[]
  cast?: string[]
  collection?: CollectionInput | null
  certification?: string | null
  runtime?: number | null
  backdropImageUrl?: string | null
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
  const syncedItem = "genres" in item ? item : (await enrichItems([item]))[0]!
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
      ? await getBookSyncMetadata(providerId)
      : await getTmdbSyncMetadata(syncedItem.type, providerId)

  const changes = changedFields(syncedItem, metadata)
  if (!Object.keys(changes).length) {
    if (!dryRun)
      await replaceItemCreators(
        syncedItem.id,
        syncedItem.type,
        syncedItem.creator
      )
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
      await replaceItemCast(syncedItem.id, nextCast)
    if (syncedItem.type === "movie" && nextCollection !== undefined)
      await replaceItemCollection(syncedItem.id, nextCollection)
    await replaceItemCreators(
      syncedItem.id,
      syncedItem.type,
      itemFields.creator ?? syncedItem.creator
    )
  }
  return { itemId: syncedItem.id, slug: syncedItem.slug, changes }
}

export const syncItem = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.number().int() }))
  .handler(async ({ data }) => {
    await requireSignedIn()
    await ensureDatabase()
    const [item] = await enrichItems(
      await db.select().from(items).where(eq(items.id, data.id))
    )
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
  url.searchParams.set(
    "append_to_response",
    type === "tv"
      ? "aggregate_credits,keywords,content_ratings"
      : "credits,keywords,release_dates"
  )
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
    backdrop_path?: string | null
    overview?: string
    runtime?: number
    episode_run_time?: number[]
    genres?: Array<{ name?: string }>
    keywords?: {
      keywords?: Array<{ name?: string }>
      results?: Array<{ name?: string }>
    }
    belongs_to_collection?: {
      id?: number
      name?: string
      overview?: string
    } | null
    created_by?: Array<{ name?: string }>
    credits?: {
      cast?: Array<{ name?: string; order?: number }>
      crew?: Array<{ job?: string; name?: string }>
    }
    aggregate_credits?: {
      cast?: Array<{
        name?: string
        order?: number
        roles?: Array<{ character?: string }>
      }>
    }
    release_dates?: {
      results?: Array<{
        iso_3166_1?: string
        release_dates?: Array<{ certification?: string; type?: number }>
      }>
    }
    content_ratings?: {
      results?: Array<{ iso_3166_1?: string; rating?: string }>
    }
  }
  const creator =
    type === "tv"
      ? (result.created_by?.[0]?.name ??
        result.credits?.crew?.find(
          (person) => person.job === "Creator" || person.job === "Director"
        )?.name)
      : result.credits?.crew?.find((person) => person.job === "Director")?.name
  const screenMetadata = tmdbScreenMetadata(type, result)
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
    description: result.overview ?? "",
    keywords:
      (type === "tv"
        ? result.keywords?.results
        : result.keywords?.keywords
      )?.flatMap((keyword) => (keyword.name ? [keyword.name] : [])) ?? [],
    ...(tmdbCast(type, result) !== undefined
      ? { cast: tmdbCast(type, result) }
      : {}),
    ...(type === "movie"
      ? { collection: tmdbCollection(result.belongs_to_collection) ?? null }
      : {}),
    certification: screenMetadata.certification ?? null,
    runtime: screenMetadata.runtime ?? null,
    backdropImageUrl: result.backdrop_path
      ? `https://image.tmdb.org/t/p/w1280${result.backdrop_path}`
      : null,
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
    description?: string | { value?: string }
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
    ...(openLibraryDescription(book.description) !== undefined
      ? { description: openLibraryDescription(book.description) }
      : {}),
  }
}

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
  ] as const) {
    if (field === "collection" && item.type !== "movie") continue
    if (field === "cast" && item.type === "book") continue
    if (
      (field === "certification" || field === "runtime") &&
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

function curatedBookGenres(subjects?: string[]) {
  const subjectSet = new Set(
    (subjects ?? []).map((subject) => subject.toLocaleLowerCase())
  )
  return bookGenreOptions.filter((genre) =>
    subjectSet.has(genre.toLocaleLowerCase())
  )
}

function openLibraryDescription(
  description?: string | { value?: string }
): string | undefined {
  if (typeof description === "string") return description
  return description?.value
}

function yearFromDate(value?: string) {
  const match = value?.match(/\b(\d{4})\b/)
  return match ? Number(match[1]) : null
}

export const getItems = createServerFn({ method: "GET" })
  .inputValidator(
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
      const search = data.query
        .trim()
        .split(/\s+/)
        .map((term) => term.replace(/[^a-z0-9]/gi, ""))
        .filter(Boolean)
        .map((term) => `${term}*`)
        .join(" AND ")
      if (search)
        filters.push(
          sql`${items.id} IN (SELECT rowid FROM item_search WHERE item_search MATCH ${search})`
        )
    }
    const records = await db
      .select()
      .from(items)
      .where(filters.length ? and(...filters) : undefined)
      .orderBy(asc(items.title))
    return enrichItems(records)
  })

export const getPersonOptions = createServerFn({ method: "GET" }).handler(
  async (): Promise<PersonOptions> => {
    await requireSignedIn()
    await ensureDatabase()
    const [authorRows, directorRows, actorRows] = await Promise.all([
      db
        .select({ name: authors.name })
        .from(authors)
        .orderBy(asc(authors.name)),
      db
        .select({ name: directors.name })
        .from(directors)
        .orderBy(asc(directors.name)),
      db.select({ name: actors.name }).from(actors).orderBy(asc(actors.name)),
    ])
    return {
      authors: authorRows.map((author) => author.name),
      directors: directorRows.map((director) => director.name),
      actors: actorRows.map((actor) => actor.name),
    }
  }
)

export const getItemsForYearBrowse = createServerFn({ method: "GET" })
  .inputValidator(
    z.object({
      type: z.enum(itemTypes),
      startYear: z.number().int().min(0).max(9999),
      endYear: z.number().int().min(0).max(9999),
    })
  )
  .handler(async ({ data }) => {
    await ensureDatabase()
    const [catalogYears, records] = await Promise.all([
      db
        .select({ year: items.year })
        .from(items)
        .where(eq(items.type, data.type))
        .orderBy(asc(items.year)),
      db
        .select()
        .from(items)
        .where(
          and(
            eq(items.type, data.type),
            gte(items.year, data.startYear),
            lte(items.year, data.endYear)
          )
        )
        .orderBy(asc(items.title)),
    ])
    return {
      years: [...new Set(catalogYears.map((item) => item.year))],
      items: await enrichItems(records),
    }
  })

export const getItemsByTag = createServerFn({ method: "GET" })
  .inputValidator(
    z.object({ kind: z.enum(["genre", "keyword"]), slug: z.string() })
  )
  .handler(async ({ data }) => {
    await ensureDatabase()
    const tagTable = data.kind === "genre" ? genres : keywords
    const joins = data.kind === "genre" ? itemGenres : itemKeywords
    const [tag] = await db
      .select({ name: tagTable.name })
      .from(tagTable)
      .where(eq(tagTable.slug, data.slug))
      .limit(1)
    if (!tag) return null
    const records = await db
      .select()
      .from(items)
      .innerJoin(joins, eq(joins.itemId, items.id))
      .where(
        data.kind === "genre"
          ? eq(
              itemGenres.genreId,
              (
                await db
                  .select({ id: genres.id })
                  .from(genres)
                  .where(eq(genres.slug, data.slug))
                  .limit(1)
              )[0]!.id
            )
          : eq(
              itemKeywords.keywordId,
              (
                await db
                  .select({ id: keywords.id })
                  .from(keywords)
                  .where(eq(keywords.slug, data.slug))
                  .limit(1)
              )[0]!.id
            )
      )
      .orderBy(asc(items.title))
    return {
      name: tag.name,
      items: await enrichItems(records.map((row) => row.items)),
    }
  })

export const getItemsByPerson = createServerFn({ method: "GET" })
  .inputValidator(
    z.object({
      kind: z.enum(["author", "director", "actor"]),
      slug: z.string(),
    })
  )
  .handler(async ({ data }) => {
    await ensureDatabase()
    if (data.kind === "author") {
      const [author] = await db
        .select({ id: authors.id, name: authors.name })
        .from(authors)
        .where(eq(authors.slug, data.slug))
        .limit(1)
      if (!author) return null
      const records = await db
        .select()
        .from(items)
        .innerJoin(itemAuthors, eq(itemAuthors.itemId, items.id))
        .where(eq(itemAuthors.authorId, author.id))
        .orderBy(asc(items.title))
      return {
        name: author.name,
        items: await enrichItems(records.map((row) => row.items)),
      }
    }

    if (data.kind === "actor") {
      const [actor] = await db
        .select({ id: actors.id, name: actors.name })
        .from(actors)
        .where(eq(actors.slug, data.slug))
        .limit(1)
      if (!actor) return null
      const records = await db
        .select()
        .from(items)
        .innerJoin(itemActors, eq(itemActors.itemId, items.id))
        .where(eq(itemActors.actorId, actor.id))
        .orderBy(asc(items.title))
      return {
        name: actor.name,
        items: await enrichItems(records.map((row) => row.items)),
      }
    }

    const [director] = await db
      .select({ id: directors.id, name: directors.name })
      .from(directors)
      .where(eq(directors.slug, data.slug))
      .limit(1)
    if (!director) return null
    const records = await db
      .select()
      .from(items)
      .innerJoin(itemDirectors, eq(itemDirectors.itemId, items.id))
      .where(eq(itemDirectors.directorId, director.id))
      .orderBy(asc(items.title))
    return {
      name: director.name,
      items: await enrichItems(records.map((row) => row.items)),
    }
  })

export const getItemsByCollection = createServerFn({ method: "GET" })
  .inputValidator(z.object({ slug: z.string() }))
  .handler(async ({ data }) => {
    await ensureDatabase()
    const [collection] = await db
      .select({
        id: collections.id,
        name: collections.name,
        overview: collections.overview,
      })
      .from(collections)
      .where(eq(collections.slug, data.slug))
      .limit(1)
    if (!collection) return null
    const records = await db
      .select()
      .from(items)
      .innerJoin(itemCollections, eq(itemCollections.itemId, items.id))
      .where(
        and(
          eq(itemCollections.collectionId, collection.id),
          eq(items.type, "movie")
        )
      )
      .orderBy(asc(items.title))
    return {
      ...collection,
      items: await enrichItems(records.map((row) => row.items)),
    }
  })

export const getItemsByList = createServerFn({ method: "GET" })
  .inputValidator(
    z.object({
      listSlug: z.string(),
      type: z.enum(itemTypes),
      query: z.string().max(100).optional(),
    })
  )
  .handler(async ({ data }) => {
    await ensureDatabase()
    const [list] = await db
      .select({ id: lists.id, name: lists.name })
      .from(lists)
      .innerJoin(listPlacements, eq(listPlacements.listId, lists.id))
      .where(eq(lists.slug, data.listSlug))
      .limit(1)
    if (!list) return null
    const [placement] = await db
      .select({ id: listPlacements.id })
      .from(listPlacements)
      .where(
        and(
          eq(listPlacements.listId, list.id),
          eq(listPlacements.type, data.type)
        )
      )
      .limit(1)
    if (!placement) return null

    const filters = [eq(listItems.listId, list.id), eq(items.type, data.type)]
    if (data.query?.trim()) {
      const search = data.query
        .trim()
        .split(/\s+/)
        .map((term) => term.replace(/[^a-z0-9]/gi, ""))
        .filter(Boolean)
        .map((term) => `${term}*`)
        .join(" AND ")
      if (search) {
        filters.push(
          sql`${items.id} IN (SELECT rowid FROM item_search WHERE item_search MATCH ${search})`
        )
      }
    }

    const records = await db
      .select()
      .from(items)
      .innerJoin(listItems, eq(listItems.itemId, items.id))
      .where(and(...filters))
      .orderBy(asc(listItems.position))
    return {
      name: list.name,
      items: await enrichItems(records.map((row) => row.items)),
    }
  })

type HomeRow =
  | { title: string; kind: "recent"; items: Item[] }
  | { title: string; slug: string; kind: "list" | "collection"; items: Item[] }

export const getHomeRows = createServerFn({ method: "GET" })
  .inputValidator(z.object({ type: z.enum(itemTypes) }))
  .handler(async ({ data }): Promise<HomeRow[]> => {
    await ensureDatabase()
    const recentItems = await enrichItems(
      await db
        .select()
        .from(items)
        .where(eq(items.type, data.type))
        .orderBy(desc(items.createdAt))
        .limit(12)
    )
    const placements = await db
      .select({
        listId: listPlacements.listId,
        slug: lists.slug,
        title: lists.name,
        kind: listPlacements.kind,
      })
      .from(listPlacements)
      .leftJoin(lists, eq(listPlacements.listId, lists.id))
      .where(
        and(
          eq(listPlacements.type, data.type),
          eq(listPlacements.visible, true)
        )
      )
      .orderBy(asc(listPlacements.position))
    const allItems = await enrichItems(
      await db.select().from(items).where(eq(items.type, data.type))
    )
    const memberships = await db
      .select({
        listId: listItems.listId,
        itemId: listItems.itemId,
        position: listItems.position,
      })
      .from(listItems)
      .orderBy(asc(listItems.position))

    const itemsById = new Map(allItems.map((item) => [item.id, item]))
    const rows: HomeRow[] = placements.flatMap<HomeRow>((placement) => {
      if (placement.kind === "recent")
        return recentItems.length
          ? [
              {
                title: "Recently added",
                kind: "recent" as const,
                items: recentItems,
              },
            ]
          : []
      const rowItems = memberships.flatMap((membership) => {
        const item = itemsById.get(membership.itemId)
        return membership.listId === placement.listId && item ? [item] : []
      })
      return rowItems.length
        ? [
            {
              title: placement.title!,
              slug: placement.slug!,
              kind: "list" as const,
              items: rowItems,
            },
          ]
        : []
    })
    const collectionRows: HomeRow[] =
      data.type === "movie"
        ? [
            ...new Map(
              allItems
                .flatMap((item) =>
                  item.collection
                    ? [[item.collection.slug, item.collection.name] as const]
                    : []
                )
                .map(([slug, name]) => [
                  slug,
                  {
                    title: name,
                    slug,
                    kind: "collection" as const,
                    items: allItems.filter(
                      (item) => item.collection?.slug === slug
                    ),
                  },
                ])
            ).values(),
          ]
        : []
    return [...rows, ...collectionRows]
  })

export const getItemBySlug = createServerFn({ method: "GET" })
  .inputValidator(z.object({ slug: z.string() }))
  .handler(async ({ data }) => {
    await ensureDatabase()
    const [item] = await enrichItems(
      await db.select().from(items).where(eq(items.slug, data.slug))
    )
    if (!item) return null
    const customLists = await db
      .select({
        slug: lists.slug,
        name: lists.name,
        containsItem: sql<boolean>`exists(
          select 1 from ${listItems}
          where ${listItems.listId} = ${lists.id}
            and ${listItems.itemId} = ${item.id}
        )`,
      })
      .from(listPlacements)
      .innerJoin(lists, eq(listPlacements.listId, lists.id))
      .where(eq(listPlacements.type, item.type))
      .orderBy(asc(listPlacements.position))
    return {
      ...item,
      customLists,
    }
  })

export const getSimilarOwnedItems = createServerFn({ method: "GET" })
  .inputValidator(z.object({ itemId: z.number().int() }))
  .handler(async ({ data }): Promise<Item[]> => {
    await ensureDatabase()
    const [item] = await db
      .select({
        id: items.id,
        type: items.type,
        tmdbId: items.tmdbId,
      })
      .from(items)
      .where(eq(items.id, data.itemId))
      .limit(1)

    if (
      !item ||
      (item.type !== "movie" && item.type !== "tv") ||
      !item.tmdbId ||
      !process.env.TMDB_API_KEY
    )
      return []

    const relatedTmdbIds = await getTmdbRelatedIds(item.type, item.tmdbId)
    if (!relatedTmdbIds.length) return []

    const ownedRecords = await db
      .select()
      .from(items)
      .where(
        and(
          eq(items.type, item.type),
          eq(items.status, "owned"),
          inArray(items.tmdbId, relatedTmdbIds)
        )
      )
    const ownedItems = await enrichItems(ownedRecords)
    const itemsByTmdbId = new Map(
      ownedItems.flatMap((ownedItem) =>
        ownedItem.id !== item.id && ownedItem.tmdbId
          ? [[ownedItem.tmdbId, ownedItem]]
          : []
      )
    )

    return relatedTmdbIds.flatMap((tmdbId) => {
      const relatedItem = itemsByTmdbId.get(tmdbId)
      return relatedItem ? [relatedItem] : []
    })
  })

async function getTmdbRelatedIds(
  type: "movie" | "tv",
  tmdbId: string
): Promise<string[]> {
  const apiKey = process.env.TMDB_API_KEY
  if (!apiKey) return []

  const results = await Promise.all(
    ["similar", "recommendations"].map(async (kind) => {
      try {
        const url = new URL(
          `https://api.themoviedb.org/3/${type}/${tmdbId}/${kind}`
        )
        url.searchParams.set("api_key", apiKey)
        url.searchParams.set("language", "en-US")
        const response = await fetch(url)
        if (!response.ok) return []
        return tmdbResultIds(await response.json())
      } catch {
        return []
      }
    })
  )
  return [...new Set(results.flat())]
}

function tmdbResultIds(body: unknown): string[] {
  if (!isTmdbResults(body)) return []
  return body.results.flatMap((result) =>
    typeof result.id === "number" || typeof result.id === "string"
      ? [String(result.id)]
      : []
  )
}

function isTmdbResults(
  body: unknown
): body is { results: Array<{ id?: string | number }> } {
  return (
    typeof body === "object" &&
    body !== null &&
    "results" in body &&
    Array.isArray(body.results) &&
    body.results.every(
      (result) =>
        typeof result === "object" &&
        result !== null &&
        (!("id" in result) ||
          typeof result.id === "string" ||
          typeof result.id === "number")
    )
  )
}

export const getItemById = createServerFn({ method: "GET" })
  .inputValidator(z.object({ id: z.number().int() }))
  .handler(async ({ data }) => {
    await requireSignedIn()
    await ensureDatabase()
    const [item] = await enrichItems(
      await db.select().from(items).where(eq(items.id, data.id))
    )
    return item ?? null
  })

export const getSignedInStatus = createServerFn({ method: "GET" }).handler(
  async () => {
    const { isSignedIn } = await import("./auth")
    return isSignedIn()
  }
)

export const getAdminStatus = createServerFn({ method: "GET" }).handler(
  async () => {
    const { isAdmin } = await import("./auth")
    return isAdmin()
  }
)

export const getLoginMode = createServerFn({ method: "GET" }).handler(
  async () => {
    await ensureDatabase()
    const [admin] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.role, "admin"))
      .limit(1)
    return { requiresEmail: Boolean(admin) }
  }
)

export const saveItem = createServerFn({ method: "POST" })
  .inputValidator(itemInput)
  .handler(async ({ data }) => {
    await requireSignedIn()
    await ensureDatabase()
    const now = new Date().toISOString()
    const coverImageUrl = await storeCover(data.coverImageUrl ?? "", data.slug)
    const primaryPeople =
      data.type === "book"
        ? data.authors.length
          ? data.authors
          : parseCreatorNames(data.creator)
        : data.directors.length
          ? data.directors
          : parseCreatorNames(data.creator)
    const creator = primaryPeople[0]
    if (!creator)
      throw new Error(
        `Add at least one ${data.type === "book" ? "author" : "director"}.`
      )
    const values = {
      slug: data.slug,
      type: data.type,
      status: data.status,
      title: data.title,
      creator,
      year: data.year,
      coverImageUrl: coverImageUrl || null,
      openLibraryKey: data.openLibraryKey || null,
      tmdbId: data.tmdbId || null,
      barcode: data.barcode || null,
      borrower: data.borrower?.trim() || null,
      loanedAt: data.loanedAt || null,
      format: data.format?.trim() || null,
      edition: normalizeEdition(data.edition),
      notes: "",
      acquiredAt: null,
      updatedAt: now,
      description: data.description?.trim() || null,
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
      await replaceItemTags(data.id, { genres: data.genres })
      await replaceItemCreators(data.id, data.type, primaryPeople)
      if (data.type !== "book") await replaceItemCast(data.id, data.actors)
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
    await replaceItemTags(item.id, { genres: data.genres })
    await replaceItemCreators(item.id, data.type, primaryPeople)
    if (data.type !== "book") await replaceItemCast(item.id, data.actors)
    return item
  })

export const deleteItem = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.number().int() }))
  .handler(async ({ data }) => {
    await requireSignedIn()
    await ensureDatabase()
    await db.delete(listItems).where(eq(listItems.itemId, data.id))
    await db.delete(items).where(eq(items.id, data.id))
    return { ok: true }
  })

export const login = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      email: z.string().email().optional().or(z.literal("")),
      password: z.string().min(1),
    })
  )
  .handler(async ({ data }) => {
    const { startBootstrapSession, startUserSession, verifyStoredPassword } =
      await import("./auth")
    await ensureDatabase()
    const [storedAdmin] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.role, "admin"))
      .limit(1)
    if (!storedAdmin) {
      if (!process.env.ADMIN_PASSWORD) {
        return {
          ok: false,
          error:
            "Admin access is not configured. Set ADMIN_PASSWORD to enable it.",
        }
      }
      const expected = process.env.ADMIN_PASSWORD.trim()
      if (data.password !== expected)
        return { ok: false, error: "That password doesn’t open this shelf." }
      startBootstrapSession()
      return { ok: true, error: "" }
    }
    if (!data.email) {
      return {
        ok: false,
        error: "Enter your email and password.",
      }
    }
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, data.email.trim().toLowerCase()))
      .limit(1)
    if (
      !user ||
      !(await verifyStoredPassword(data.password, user.passwordHash))
    )
      return { ok: false, error: "That password doesn’t open this shelf." }
    await startUserSession(user.id)
    return { ok: true, error: "" }
  })

export const logout = createServerFn({ method: "POST" }).handler(async () => {
  const { endSession } = await import("./auth")
  await endSession()
  return { ok: true }
})
