import { and, asc, desc, eq, inArray, isNull, ne, or, sql } from "drizzle-orm"
import { createServerFn } from "@tanstack/react-start"
import { getRequestHeader } from "@tanstack/react-start/server"
import { z } from "zod"
import { displayListName } from "@/lib/system-lists"
import { parseImportQuery, rankImportCandidates } from "@/lib/import-query"
import { db } from "./db"
import {
  fetchTmdbCollectionPartIds,
  fetchTmdbExtras,
  TMDB_EXTRAS_APPEND,
  tmdbExtrasFrom,
  type TmdbExtrasSource,
} from "./tmdb"
import {
  itemFormats,
  normalizeEdition,
  normalizeTitle,
  parseCreatorNames,
  slugify,
  systemListSlug,
  type CatalogItem,
  type ItemStatus,
  type ItemType,
} from "@/lib/catalog"
import { bookGenreOptions, itemInput, type ItemInput } from "@/lib/item-input"
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
  itemTypes,
  listItems,
  listPlacements,
  lists,
  users,
  type Item,
  type ItemRecord,
  type Collection,
} from "./schema"

export {
  bookGenreOptions,
  screenGenreOptions,
  type ItemInput,
} from "@/lib/item-input"

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
      format: z.enum(itemFormats).optional().or(z.literal("")),
      edition: z.enum(itemEditions).optional().or(z.literal("")),
      dryRun: z.boolean().optional(),
      items: z
        .array(
          z.object({
            query: z.string().trim().min(1).max(200),
            providerId: z.string().trim().min(1).max(120).optional(),
          })
        )
        .min(1)
        .max(80),
    })
  )
  .handler(async ({ data }) => {
    if (!isAgentToken(getRequestHeader("authorization")))
      await requireSignedIn()
    const added: Array<{ title: string; slug: string }> = []
    const skipped: Array<{ query: string; reason: string }> = []
    const failed: Array<{ query: string; reason: string }> = []
    const needsReview: Array<{
      query: string
      candidates: Array<{
        id: string
        title: string
        year: number | null
        creator: string
        coverImageUrl: string
      }>
    }> = []
    for (const input of data.items) {
      try {
        const { title, year } = parseImportQuery(input.query)
        const pinnedId = input.providerId
          ? data.type === "book"
            ? normalizeOpenLibraryWorkKey(input.providerId)
            : input.providerId
          : undefined
        let top
        if (pinnedId) {
          top = await getCollectionResultById({
            type: data.type,
            id: pinnedId,
          })
        } else {
          const matches = await lookupCollection({ type: data.type, query: title })
          const { top: best, ranked } = rankImportCandidates(
            matches,
            title,
            year
          )
          top = best
          if (!top) {
            needsReview.push({
              query: input.query,
              candidates: ranked
                .slice(0, 5)
                .map(({ id, title, year, creator, coverImageUrl }) => ({
                  id,
                  title,
                  year,
                  creator,
                  coverImageUrl,
                })),
            })
            continue
          }
        }
        const providerId = pinnedId ?? top.id
        if (
          await itemExists({
            type: data.type,
            title: top.title,
            year: top.year ?? 0,
            providerId,
            edition: data.edition,
          })
        ) {
          skipped.push({ query: input.query, reason: "Already on Shelf" })
          continue
        }
        const providerResult = pinnedId
          ? top
          : await getCollectionResultById({ type: data.type, id: providerId })
        if (data.dryRun) {
          added.push({
            title: providerResult.title,
            slug: await uniqueSlug(
              slugify(providerResult.title),
              data.edition
            ),
          })
          continue
        }
        const created = await createItemFromProvider({
          type: data.type,
          providerId,
          result: providerResult,
          fallbackCreator: top.creator,
          fallbackCoverImageUrl: top.coverImageUrl,
          format: data.format,
          edition: data.edition,
        })
        added.push({ title: created.title, slug: created.slug })
      } catch (cause) {
        failed.push({
          query: input.query,
          reason: cause instanceof Error ? cause.message : "Import failed",
        })
      }
    }
    return { added, skipped, failed, needsReview }
  })

export type ProviderImportInput = {
  type: ItemType
  providerId: string
  // Not `& { slug }` from getCollectionResultById: the slug is recomputed
  // here, and the agent API's ranked candidates carry no slug.
  result: LookupResult
  fallbackCreator?: string
  fallbackCoverImageUrl?: string | null
  format?: string | null
  edition?: string | null
  status?: ItemStatus | ""
}

// Inserts a provider result as a new item with its tags, people and
// collection. Shared by the admin bulk import and the agent API so slugs,
// editions and descriptions are written the same way.
export async function createItemFromProvider(input: ProviderImportInput) {
  const result = input.result
  const creator =
    result.creator === "Unknown author" && input.fallbackCreator
      ? input.fallbackCreator
      : result.creator
  const coverImageUrl =
    result.coverImageUrl || input.fallbackCoverImageUrl || ""
  const slug = await uniqueSlug(slugify(result.title), input.edition)
  const now = new Date().toISOString()
  const [created] = await db
    .insert(items)
    .values({
      slug,
      type: input.type,
      status: input.status || "owned",
      title: result.title,
      creator,
      year: result.year ?? 0,
      format: input.format || null,
      edition: normalizeEdition(input.edition),
      description: result.description || null,
      certification: result.certification ?? null,
      runtime: result.runtime ?? null,
      coverImageUrl: (await storeCover(coverImageUrl, slug)) || null,
      backdropImageUrl: result.backdropImageUrl || null,
      tmdbId: input.type === "book" ? null : input.providerId,
      openLibraryKey: input.type === "book" ? input.providerId : null,
      notes: "",
      acquiredAt: null,
      createdAt: now,
      updatedAt: now,
    })
    .returning({ id: items.id, title: items.title, slug: items.slug })
  await replaceItemTags(created.id, {
    genres: result.genres,
    keywords: result.keywords ?? [],
  })
  await replaceItemCreators(
    created.id,
    input.type,
    result.creatorPeople ?? creator
  )
  if (input.type !== "book" && result.cast !== undefined)
    await replaceItemCast(
      created.id,
      result.castPeople ?? result.cast.map((name) => ({ name }))
    )
  if (input.type === "movie")
    await replaceItemCollection(created.id, result.collection ?? null)
  return created
}

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
  castPeople?: ProviderPerson[]
  creatorPeople?: ProviderPerson[]
  collection?: CollectionInput
  certification?: string
  runtime?: number
  subtitle?: string
  pageCount?: number
  publisher?: string
  isbn13?: string
}

type ProviderPerson = {
  name: string
  providerId?: string
}

type CollectionInput = {
  tmdbCollectionId?: string
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
      "key,title,author_name,author_key,first_publish_year,cover_i"
    )
    url.searchParams.set("limit", "6")
    const response = await fetch(url, {
      signal: AbortSignal.timeout(10_000),
      headers: { "User-Agent": "Shelf (https://github.com/ryanleichty/shelf)" },
    })
    if (!response.ok)
      throw new Error("Open Library could not complete that search.")
    const body = (await response.json()) as {
      docs?: Array<{
        key?: string
        title?: string
        author_name?: string[]
        author_key?: string[]
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
              creatorPeople:
                book.author_name?.flatMap((name, index) =>
                  name
                    ? [
                        {
                          name,
                          providerId: normalizeOpenLibraryAuthorKey(
                            book.author_key?.[index]
                          ),
                        },
                      ]
                    : []
                ) ?? [],
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
  const response = await fetch(url, { signal: AbortSignal.timeout(10_000) })
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
      tmdbId: z.string().regex(/^\d+$/).optional(),
    })
  )
  .handler(async ({ data }): Promise<string[]> => {
    await requireSignedIn()
    if (data.type === "book" && data.openLibraryKey) {
      const workId = data.openLibraryKey.replace(/^\/?works\//, "")
      const response = await fetch(
        `https://openlibrary.org/works/${workId}/editions.json?limit=100`,
        {
          signal: AbortSignal.timeout(10_000),
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
        const response = await fetch(url, {
          signal: AbortSignal.timeout(10_000),
        })
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

export async function replaceItemCreators(
  itemId: number,
  type: Item["type"],
  creators: string | string[] | ProviderPerson[]
) {
  const people: ProviderPerson[] =
    typeof creators === "string"
      ? parseCreatorNames(creators).map((name) => ({ name }))
      : creators.map((creator) =>
          typeof creator === "string" ? { name: creator } : creator
        )
  const normalized = [
    ...new Map(
      people
        .map((person) => ({ ...person, name: person.name.trim() }))
        .filter((person) => person.name)
        .map((person) => [person.providerId ?? person.name, person])
    ).values(),
  ]
  const kind = type === "book" ? "author" : "director"
  await db
    .delete(kind === "author" ? itemAuthors : itemDirectors)
    .where(
      eq(kind === "author" ? itemAuthors.itemId : itemDirectors.itemId, itemId)
    )
  for (const person of normalized) {
    const id =
      kind === "author"
        ? await upsertAuthor(person)
        : await upsertDirector(person)
    if (kind === "author")
      await db
        .insert(itemAuthors)
        .values({ itemId, authorId: id })
        .onConflictDoNothing()
    else
      await db
        .insert(itemDirectors)
        .values({ itemId, directorId: id })
        .onConflictDoNothing()
  }
}

export async function replaceItemCast(
  itemId: number,
  people: ProviderPerson[]
) {
  const normalized = [
    ...new Map(
      people
        .map((person) => ({ ...person, name: person.name.trim() }))
        .filter((person) => person.name)
        .map((person) => [person.providerId ?? person.name, person])
    ).values(),
  ]
  await db.delete(itemActors).where(eq(itemActors.itemId, itemId))
  for (const [position, person] of normalized.entries()) {
    const id = await upsertActor(person)
    await db
      .insert(itemActors)
      .values({ itemId, actorId: id, position })
      .onConflictDoNothing()
  }
}

async function upsertAuthor(person: ProviderPerson) {
  const slug = slugify(person.name)
  if (!slug) throw new Error("Person name needs letters or numbers.")
  const [byProvider] = person.providerId
    ? await db
        .select()
        .from(authors)
        .where(eq(authors.openLibraryKey, person.providerId))
        .limit(1)
    : []
  const [bySlug] = byProvider
    ? []
    : await db.select().from(authors).where(eq(authors.slug, slug)).limit(1)
  const existing = byProvider ?? bySlug
  if (existing) {
    const [slugOwner] =
      person.providerId &&
      existing.slug === slugify(existing.name) &&
      existing.slug !== slug
        ? await db
            .select({ id: authors.id })
            .from(authors)
            .where(eq(authors.slug, slug))
            .limit(1)
        : []
    await db
      .update(authors)
      .set({
        name: person.providerId ? person.name : existing.name,
        ...(person.providerId && !existing.openLibraryKey
          ? { openLibraryKey: person.providerId }
          : {}),
        ...(person.providerId &&
        existing.slug === slugify(existing.name) &&
        existing.slug !== slug &&
        (!slugOwner || slugOwner.id === existing.id)
          ? { slug }
          : {}),
      })
      .where(eq(authors.id, existing.id))
    return existing.id
  }
  const [created] = await db
    .insert(authors)
    .values({
      slug,
      name: person.name,
      openLibraryKey: person.providerId ?? null,
    })
    .returning({ id: authors.id })
  return created.id
}

async function upsertDirector(person: ProviderPerson) {
  const slug = slugify(person.name)
  if (!slug) throw new Error("Person name needs letters or numbers.")
  const [byProvider] = person.providerId
    ? await db
        .select()
        .from(directors)
        .where(eq(directors.tmdbPersonId, person.providerId))
        .limit(1)
    : []
  const [bySlug] = byProvider
    ? []
    : await db.select().from(directors).where(eq(directors.slug, slug)).limit(1)
  const existing = byProvider ?? bySlug
  if (existing) {
    const [slugOwner] =
      person.providerId &&
      existing.slug === slugify(existing.name) &&
      existing.slug !== slug
        ? await db
            .select({ id: directors.id })
            .from(directors)
            .where(eq(directors.slug, slug))
            .limit(1)
        : []
    await db
      .update(directors)
      .set({
        name: person.providerId ? person.name : existing.name,
        ...(person.providerId && !existing.tmdbPersonId
          ? { tmdbPersonId: person.providerId }
          : {}),
        ...(person.providerId &&
        existing.slug === slugify(existing.name) &&
        existing.slug !== slug &&
        (!slugOwner || slugOwner.id === existing.id)
          ? { slug }
          : {}),
      })
      .where(eq(directors.id, existing.id))
    return existing.id
  }
  const [created] = await db
    .insert(directors)
    .values({
      slug,
      name: person.name,
      tmdbPersonId: person.providerId ?? null,
    })
    .returning({ id: directors.id })
  return created.id
}

async function upsertActor(person: ProviderPerson) {
  const slug = slugify(person.name)
  if (!slug) throw new Error("Person name needs letters or numbers.")
  const [byProvider] = person.providerId
    ? await db
        .select()
        .from(actors)
        .where(eq(actors.tmdbPersonId, person.providerId))
        .limit(1)
    : []
  const [bySlug] = byProvider
    ? []
    : await db.select().from(actors).where(eq(actors.slug, slug)).limit(1)
  const existing = byProvider ?? bySlug
  if (existing) {
    const [slugOwner] =
      person.providerId &&
      existing.slug === slugify(existing.name) &&
      existing.slug !== slug
        ? await db
            .select({ id: actors.id })
            .from(actors)
            .where(eq(actors.slug, slug))
            .limit(1)
        : []
    await db
      .update(actors)
      .set({
        name: person.providerId ? person.name : existing.name,
        ...(person.providerId && !existing.tmdbPersonId
          ? { tmdbPersonId: person.providerId }
          : {}),
        ...(person.providerId &&
        existing.slug === slugify(existing.name) &&
        existing.slug !== slug &&
        (!slugOwner || slugOwner.id === existing.id)
          ? { slug }
          : {}),
      })
      .where(eq(actors.id, existing.id))
    return existing.id
  }
  const [created] = await db
    .insert(actors)
    .values({
      slug,
      name: person.name,
      tmdbPersonId: person.providerId ?? null,
    })
    .returning({ id: actors.id })
  return created.id
}

async function replaceItemTags(
  itemId: number,
  tags: { genres?: string[]; keywords?: string[] }
) {
  if (tags.genres !== undefined) await upsertTags(itemId, "genre", tags.genres)
  if (tags.keywords !== undefined)
    await upsertTags(itemId, "keyword", tags.keywords)
}

export async function replaceItemCollection(
  itemId: number,
  collection: CollectionInput | null
) {
  await db.delete(itemCollections).where(eq(itemCollections.itemId, itemId))
  if (!collection) return

  const [existing] = await db
    .select({ id: collections.id, partIds: collections.partIds })
    .from(collections)
    .where(
      collection.tmdbCollectionId
        ? eq(collections.tmdbCollectionId, collection.tmdbCollectionId)
        : eq(collections.slug, slugify(collection.name))
    )
    .limit(1)
  const collectionId =
    existing?.id ??
    (
      await db
        .insert(collections)
        .values({
          slug: await uniqueCollectionSlug(collection.name),
          name: collection.name,
          tmdbCollectionId: collection.tmdbCollectionId ?? null,
          overview: collection.overview || null,
        })
        .returning({ id: collections.id })
    )[0].id

  await db
    .insert(itemCollections)
    .values({ itemId, collectionId })
    .onConflictDoNothing()
  if (collection.tmdbCollectionId && !existing?.partIds?.length) {
    const partIds = await fetchTmdbCollectionPartIds(
      collection.tmdbCollectionId
    )
    if (partIds.length)
      await db
        .update(collections)
        .set({ partIds })
        .where(eq(collections.id, collectionId))
  }
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
    systemListMembershipRows,
  ] = await db.batch([
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
        partIds: collections.partIds,
      })
      .from(itemCollections)
      .innerJoin(collections, eq(itemCollections.collectionId, collections.id))
      .where(inArray(itemCollections.itemId, itemIds)),
    db
      .select({ itemId: listItems.itemId, slug: lists.slug })
      .from(listItems)
      .innerJoin(lists, eq(listItems.listId, lists.id))
      .where(and(inArray(listItems.itemId, itemIds), eq(lists.system, true))),
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
  const itemTypesById = new Map(records.map((item) => [item.id, item.type]))
  const systemListItemIds = new Set(
    systemListMembershipRows.flatMap(({ itemId, slug }) =>
      (
        itemTypesById.get(itemId) === "book"
          ? slug === "reading-list"
          : slug === "watchlist"
      )
        ? [itemId]
        : []
    )
  )
  return records.map((item) => ({
    ...item,
    genres: (genreNames.get(item.id) ?? []).map((tag) => tag.name),
    keywords: (keywordNames.get(item.id) ?? []).map((tag) => tag.name),
    authors: (authorNames.get(item.id) ?? []).map((person) => person.name),
    directors: (directorNames.get(item.id) ?? []).map((person) => person.name),
    actors: (actorNames.get(item.id) ?? []).map((person) => person.name),
    isInSystemList: systemListItemIds.has(item.id),
    ...(collectionsByItem.has(item.id)
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
    signal: AbortSignal.timeout(10_000),
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
    signal: AbortSignal.timeout(10_000),
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
  const providerId = normalizeOpenLibraryAuthorKey(author?.key)
  return {
    ...result,
    creator: authorName || result.creator,
    creatorPeople: authorName
      ? [{ name: authorName, providerId }]
      : result.creatorPeople,
    year: yearFromDate(edition.publish_date) ?? result.year,
    coverImageUrl: edition.covers?.[0]
      ? `https://covers.openlibrary.org/b/id/${edition.covers[0]}-L.jpg`
      : result.coverImageUrl,
  }
}

async function lookupOpenLibraryAuthor(key: string) {
  const response = await fetch(`https://openlibrary.org${key}.json`, {
    signal: AbortSignal.timeout(10_000),
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
    signal: AbortSignal.timeout(10_000),
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
  .inputValidator(
    z.object({ id: z.string().min(1).max(120), type: z.enum(itemTypes) })
  )
  .handler(async ({ data }): Promise<LookupResult & { slug: string }> => {
    if (!isAgentToken(getRequestHeader("authorization")))
      await requireSignedIn()
    if (data.type === "book") normalizeOpenLibraryWorkKey(data.id)
    else if (!/^\d+$/.test(data.id)) throw new Error("Invalid provider id.")
    return getCollectionResultById(data)
  })

export function normalizeOpenLibraryWorkKey(key: string) {
  const workId = key
    .trim()
    .replace(/^\/?works\//, "")
    .replace(/^\//, "")
  const workKey = `/works/${workId}`
  if (!/^\/works\/OL\d+W$/.test(workKey))
    throw new Error("Invalid Open Library key.")
  return workKey
}

function normalizeOpenLibraryAuthorKey(key?: string) {
  if (!key?.trim()) return undefined
  const authorId = key
    .trim()
    .replace(/^\/?authors\//, "")
    .replace(/^\//, "")
  const authorKey = `/authors/${authorId}`
  // Provider responses carry well-formed keys; drop an odd one rather than
  // failing the whole search or sync it arrived in.
  if (!/^\/authors\/OL\d+A$/.test(authorKey)) return undefined
  return authorKey
}

export async function getCollectionResultById(data: {
  id: string
  type: "book" | "movie" | "tv"
}): Promise<LookupResult & { slug: string }> {
  if (data.type === "book") {
    const id = normalizeOpenLibraryWorkKey(data.id)
    const response = await fetch(`https://openlibrary.org${id}.json`, {
      signal: AbortSignal.timeout(10_000),
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
      authors?: Array<{ author?: { key?: string }; name?: string }>
    }
    const authorPeople = await openLibraryAuthors(book.authors)
    const title = book.title ?? "Untitled"
    return {
      id,
      type: "book",
      title,
      creator: authorPeople[0]?.name ?? "Unknown author",
      creatorPeople: authorPeople,
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
  const response = await fetch(url, { signal: AbortSignal.timeout(10_000) })
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
    created_by?: Array<{ id?: number; name?: string }>
    credits?: {
      cast?: Array<{ id?: number; name?: string; order?: number }>
      crew?: Array<{ id?: number; job?: string; name?: string }>
    }
    aggregate_credits?: {
      cast?: Array<{
        id?: number
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
  const creatorPerson =
    data.type === "tv"
      ? (result.created_by?.[0] ??
        result.credits?.crew?.find(
          (person) => person.job === "Creator" || person.job === "Director"
        ))
      : result.credits?.crew?.find((person) => person.job === "Director")
  const creator =
    creatorPerson?.name ??
    (data.type === "tv" ? "Creator unavailable" : "Director unavailable")
  return {
    id: data.id,
    type: data.type,
    title,
    creator,
    creatorPeople: creatorPerson?.name
      ? [
          {
            name: creatorPerson.name,
            providerId:
              typeof creatorPerson.id === "number"
                ? String(creatorPerson.id)
                : undefined,
          },
        ]
      : [],
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
    ...(tmdbCastPeople(data.type, result) !== undefined
      ? { castPeople: tmdbCastPeople(data.type, result) }
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
    credits?: { cast?: Array<{ id?: number; name?: string; order?: number }> }
    aggregate_credits?: {
      cast?: Array<{
        id?: number
        name?: string
        order?: number
        roles?: Array<{ character?: string }>
      }>
    }
  }
): string[] | undefined {
  return tmdbCastPeople(type, result)?.map((person) => person.name)
}

function tmdbCastPeople(
  type: "movie" | "tv",
  result: {
    credits?: { cast?: Array<{ id?: number; name?: string; order?: number }> }
    aggregate_credits?: {
      cast?: Array<{
        id?: number
        name?: string
        order?: number
        roles?: Array<{ character?: string }>
      }>
    }
  }
): ProviderPerson[] | undefined {
  const cast =
    type === "movie" ? result.credits?.cast : result.aggregate_credits?.cast
  if (!cast) return undefined
  return cast
    .flatMap((person, index) => {
      const name = person.name?.trim()
      if (!name) return []
      return [
        {
          name,
          ...(typeof person.id === "number"
            ? { providerId: String(person.id) }
            : {}),
          order: person.order ?? index,
        },
      ]
    })
    .sort((a, b) => a.order - b.order)
    .map(({ name, providerId }) => ({ name, providerId }))
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
      await replaceItemCreators(
        syncedItem.id,
        syncedItem.type,
        metadata.creatorPeople ?? syncedItem.creator
      )
      if (syncedItem.type !== "book" && metadata.castPeople)
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
      await replaceItemCollection(syncedItem.id, nextCollection)
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
      ? `aggregate_credits,keywords,content_ratings,${TMDB_EXTRAS_APPEND}`
      : `credits,keywords,release_dates,${TMDB_EXTRAS_APPEND}`
  )
  url.searchParams.set("include_image_language", "en,null")
  url.searchParams.set("api_key", apiKey)
  const response = await fetch(url, { signal: AbortSignal.timeout(10_000) })
  if (response.status === 404)
    throw new Error(`Provider 404: TMDB ${type} ${tmdbId} was not found.`)
  if (!response.ok) throw new Error(`TMDB could not load ${type} ${tmdbId}.`)
  const result = (await response.json()) as TmdbExtrasSource & {
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
    created_by?: Array<{ id?: number; name?: string }>
    credits?: {
      cast?: Array<{ id?: number; name?: string; order?: number }>
      crew?: Array<{ id?: number; job?: string; name?: string }>
    }
    aggregate_credits?: {
      cast?: Array<{
        id?: number
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
  const creatorPerson =
    type === "tv"
      ? (result.created_by?.[0] ??
        result.credits?.crew?.find(
          (person) => person.job === "Creator" || person.job === "Director"
        ))
      : result.credits?.crew?.find((person) => person.job === "Director")
  const creator = creatorPerson?.name
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
    ...(creatorPerson?.name
      ? {
          creatorPeople: [
            {
              name: creatorPerson.name,
              providerId:
                typeof creatorPerson.id === "number"
                  ? String(creatorPerson.id)
                  : undefined,
            },
          ],
        }
      : {}),
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
    ...(tmdbCastPeople(type, result) !== undefined
      ? { castPeople: tmdbCastPeople(type, result) }
      : {}),
    ...(type === "movie"
      ? { collection: tmdbCollection(result.belongs_to_collection) ?? null }
      : {}),
    certification: screenMetadata.certification ?? null,
    runtime: screenMetadata.runtime ?? null,
    backdropImageUrl: result.backdrop_path
      ? `https://image.tmdb.org/t/p/w1280${result.backdrop_path}`
      : null,
    ...tmdbExtrasFrom(result),
  }
}

async function getBookSyncMetadata(
  openLibraryKey: string,
  coverImageUrl?: string | null,
  isbn13?: string | null
): Promise<SyncedFields> {
  const response = await fetch(
    `https://openlibrary.org${openLibraryKey}.json`,
    {
      signal: AbortSignal.timeout(10_000),
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
  const authorPeople = await openLibraryAuthors(book.authors)
  const year = yearFromDate(book.first_publish_date)
  const edition = await openLibraryEditionForCopy(
    openLibraryKey,
    coverImageUrl,
    isbn13
  )
  return {
    ...(book.title ? { title: book.title } : {}),
    ...(authorPeople.length
      ? {
          creator: authorPeople.map((author) => author.name).join(", "),
          creatorPeople: authorPeople,
        }
      : {}),
    ...(year !== null ? { year } : {}),
    genres: curatedBookGenres(book.subjects),
    ...(openLibraryDescription(book.description) !== undefined
      ? { description: openLibraryDescription(book.description) }
      : {}),
    ...edition,
  }
}

type OpenLibraryEdition = {
  works?: Array<{ key?: string }>
  covers?: number[]
  subtitle?: string
  number_of_pages?: number
  publishers?: string[]
  isbn_13?: string[]
  series?: string | string[]
}

async function openLibraryEditionForCopy(
  workKey: string,
  coverImageUrl?: string | null,
  isbn13?: string | null
): Promise<
  Pick<
    SyncedFields,
    "subtitle" | "pageCount" | "publisher" | "isbn13" | "collection"
  >
> {
  const normalizedWorkKey = normalizeOpenLibraryWorkKey(workKey)
  const existingIsbn = normalizeIsbn13(isbn13)
  let edition: OpenLibraryEdition | undefined

  if (existingIsbn) {
    const response = await fetch(
      `https://openlibrary.org/isbn/${existingIsbn}.json`,
      {
        signal: AbortSignal.timeout(10_000),
        headers: {
          "User-Agent": "Shelf (https://github.com/ryanleichty/shelf)",
        },
      }
    )
    if (response.ok) {
      const candidate = (await response.json()) as OpenLibraryEdition
      if (
        candidate.works?.some(
          (work) =>
            work.key &&
            normalizeOpenLibraryWorkKey(work.key) === normalizedWorkKey
        )
      )
        edition = candidate
    }
  }

  if (!edition) {
    const coverId = openLibraryCoverId(coverImageUrl)
    if (!coverId) return {}
    const response = await fetch(
      `https://openlibrary.org${normalizedWorkKey}/editions.json?limit=1000`,
      {
        signal: AbortSignal.timeout(10_000),
        headers: {
          "User-Agent": "Shelf (https://github.com/ryanleichty/shelf)",
        },
      }
    )
    if (!response.ok)
      throw new Error(
        `Open Library could not load editions for ${normalizedWorkKey}.`
      )
    const body = (await response.json()) as { entries?: OpenLibraryEdition[] }
    edition = body.entries?.find((candidate) =>
      candidate.covers?.includes(coverId)
    )
    if (!edition) return {}
  }

  const subtitle = edition.subtitle?.trim()
  const publisher = edition.publishers?.find((value) => value.trim())?.trim()
  const editionIsbn = [
    ...(edition.isbn_13 ?? []),
    ...(existingIsbn ? [existingIsbn] : []),
  ]
    .map(normalizeIsbn13)
    .find(Boolean)
  const series = Array.isArray(edition.series)
    ? edition.series[0]
    : edition.series
  const seriesName = series?.trim()
  return {
    subtitle: subtitle || null,
    pageCount:
      typeof edition.number_of_pages === "number" &&
      Number.isInteger(edition.number_of_pages) &&
      edition.number_of_pages > 0
        ? edition.number_of_pages
        : null,
    publisher: publisher || null,
    isbn13: editionIsbn ?? null,
    collection: seriesName ? { name: seriesName } : null,
  }
}

function openLibraryCoverId(url?: string | null) {
  const match = url?.match(/covers\.openlibrary\.org\/b\/id\/(\d+)-/i)
  return match ? Number(match[1]) : undefined
}

function normalizeIsbn13(value?: string | null) {
  const normalized = value?.replace(/[\s-]/g, "")
  return normalized && /^\d{13}$/.test(normalized) ? normalized : undefined
}

async function openLibraryAuthors(
  authorsForWork?: Array<{ author?: { key?: string }; name?: string }>
): Promise<ProviderPerson[]> {
  return (
    await Promise.all(
      (authorsForWork ?? []).map(async (author) => {
        const providerId = normalizeOpenLibraryAuthorKey(author.author?.key)
        if (author.name?.trim()) return { name: author.name.trim(), providerId }
        if (!providerId) return undefined
        const response = await fetch(
          `https://openlibrary.org${providerId}.json`,
          {
            signal: AbortSignal.timeout(10_000),
            headers: {
              "User-Agent": "Shelf (https://github.com/ryanleichty/shelf)",
            },
          }
        )
        if (!response.ok) return undefined
        const name = ((await response.json()) as { name?: string }).name?.trim()
        return name ? { name, providerId } : undefined
      })
    )
  ).flatMap((person) => (person ? [person] : []))
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

export type SearchFacets = {
  genres: Array<{ name: string; slug: string }>
  directors: Array<{ name: string; slug: string }>
  actors: Array<{ name: string; slug: string }>
  authors: Array<{ name: string; slug: string }>
}

function normalizeFacetQuery(value: string) {
  return value
    .trim()
    .toLocaleLowerCase()
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
}

export const getSearchFacets = createServerFn({ method: "GET" })
  .inputValidator(z.object({ query: z.string().max(100) }))
  .handler(async ({ data }): Promise<SearchFacets> => {
    const query = normalizeFacetQuery(data.query)
    if (!query) return { genres: [], directors: [], actors: [], authors: [] }

    const [genreRows, directorRows, actorRows, authorRows] = await Promise.all([
      db
        .select({ name: genres.name, slug: genres.slug })
        .from(genres)
        .innerJoin(itemGenres, eq(genres.id, itemGenres.genreId))
        .groupBy(genres.id)
        .orderBy(asc(genres.name)),
      db
        .select({ name: directors.name, slug: directors.slug })
        .from(directors)
        .innerJoin(itemDirectors, eq(directors.id, itemDirectors.directorId))
        .groupBy(directors.id)
        .orderBy(asc(directors.name)),
      db
        .select({ name: actors.name, slug: actors.slug })
        .from(actors)
        .innerJoin(itemActors, eq(actors.id, itemActors.actorId))
        .groupBy(actors.id)
        .orderBy(asc(actors.name)),
      db
        .select({ name: authors.name, slug: authors.slug })
        .from(authors)
        .innerJoin(itemAuthors, eq(authors.id, itemAuthors.authorId))
        .groupBy(authors.id)
        .orderBy(asc(authors.name)),
    ])
    const matches = (rows: Array<{ name: string; slug: string }>) =>
      rows.filter((row) => normalizeFacetQuery(row.name).includes(query))

    return {
      genres: matches(genreRows),
      directors: matches(directorRows),
      actors: matches(actorRows),
      authors: matches(authorRows),
    }
  })

export const getPersonOptions = createServerFn({ method: "GET" }).handler(
  async (): Promise<PersonOptions> => {
    await requireSignedIn()
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

export function toCatalogItem(item: Item): CatalogItem {
  return {
    id: item.id,
    slug: item.slug,
    type: item.type,
    status: item.status,
    title: item.title,
    creator: item.creator,
    year: item.year,
    coverImageUrl: item.coverImageUrl,
    backdropImageUrl: item.backdropImageUrl,
    tmdbId: item.tmdbId,
    format: item.format,
    edition: item.edition,
    certification: item.certification,
    runtime: item.runtime,
    pageCount: item.pageCount,
    borrower: item.borrower,
    tagline: item.tagline,
    logoImageUrl: item.logoImageUrl,
    trailerKey: item.trailerKey,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    genres: item.genres,
    authors: item.authors,
    directors: item.directors,
    collectionId: item.collection?.id ?? null,
    isInSystemList: item.isInSystemList,
  }
}

function tagResult(rows: Array<{ name: string; itemId: number | null }>) {
  const [first] = rows
  if (!first) return null
  return {
    name: first.name,
    itemIds: rows.flatMap((row) => (row.itemId === null ? [] : [row.itemId])),
  }
}

// Person and tag pages return ids; the tiles come from the shared catalog.
export const getItemsByTag = createServerFn({ method: "GET" })
  .inputValidator(
    z.object({ kind: z.enum(["genre", "keyword"]), slug: z.string() })
  )
  .handler(async ({ data }) =>
    tagResult(
      data.kind === "genre"
        ? await db
            .select({ name: genres.name, itemId: itemGenres.itemId })
            .from(genres)
            .leftJoin(itemGenres, eq(itemGenres.genreId, genres.id))
            .where(eq(genres.slug, data.slug))
        : await db
            .select({ name: keywords.name, itemId: itemKeywords.itemId })
            .from(keywords)
            .leftJoin(itemKeywords, eq(itemKeywords.keywordId, keywords.id))
            .where(eq(keywords.slug, data.slug))
    )
  )

export const getItemsByPerson = createServerFn({ method: "GET" })
  .inputValidator(
    z.object({
      kind: z.enum(["author", "director", "actor"]),
      slug: z.string(),
    })
  )
  .handler(async ({ data }) =>
    tagResult(
      data.kind === "author"
        ? await db
            .select({ name: authors.name, itemId: itemAuthors.itemId })
            .from(authors)
            .leftJoin(itemAuthors, eq(itemAuthors.authorId, authors.id))
            .where(eq(authors.slug, data.slug))
        : data.kind === "director"
          ? await db
              .select({ name: directors.name, itemId: itemDirectors.itemId })
              .from(directors)
              .leftJoin(
                itemDirectors,
                eq(itemDirectors.directorId, directors.id)
              )
              .where(eq(directors.slug, data.slug))
          : await db
              .select({ name: actors.name, itemId: itemActors.itemId })
              .from(actors)
              .leftJoin(itemActors, eq(itemActors.actorId, actors.id))
              .where(eq(actors.slug, data.slug))
    )
  )

// Everything the item page needs in three round trips: the row, one batch
// for lists + related rows, one batch to enrich them all.
export const getItemPage = createServerFn({ method: "GET" })
  .inputValidator(z.object({ slug: z.string() }))
  .handler(async ({ data }) => {
    const [record] = await db
      .select()
      .from(items)
      .where(eq(items.slug, data.slug))
      .limit(1)
    if (!record) return null

    const containsItem = sql<number>`exists(
      select 1 from ${listItems}
      where ${listItems.listId} = ${lists.id}
        and ${listItems.itemId} = ${record.id}
    )`
    const sharesPrimaryPerson =
      record.type === "book"
        ? sql<number>`exists(
            select 1 from item_authors candidate
            inner join item_authors source
              on candidate.author_id = source.author_id
            where candidate.item_id = ${items.id}
              and source.item_id = ${record.id}
          )`
        : sql<number>`exists(
            select 1 from item_directors candidate
            inner join item_directors source
              on candidate.director_id = source.director_id
            where candidate.item_id = ${items.id}
              and source.item_id = ${record.id}
          )`
    const sharesGenre = sql<number>`exists(
      select 1 from item_genres candidate
      inner join item_genres source on candidate.genre_id = source.genre_id
      where candidate.item_id = ${items.id} and source.item_id = ${record.id}
    )`
    const outsideSourceCollection = sql`not exists(
      select 1 from item_collections candidate
      inner join item_collections source
        on candidate.collection_id = source.collection_id
      where candidate.item_id = ${items.id} and source.item_id = ${record.id}
    )`

    const [customLists, systemLists, similarRecords, collectionRows] =
      await db.batch([
        db
          .select({ slug: lists.slug, name: lists.name, containsItem })
          .from(listPlacements)
          .innerJoin(lists, eq(listPlacements.listId, lists.id))
          .where(
            and(eq(listPlacements.type, record.type), eq(lists.system, false))
          )
          .orderBy(asc(listPlacements.position)),
        db
          .select({ slug: lists.slug, name: lists.name, containsItem })
          .from(lists)
          .where(eq(lists.slug, systemListSlug(record.type)))
          .limit(1),
        db
          .select()
          .from(items)
          .where(
            and(
              eq(items.type, record.type),
              eq(items.status, "owned"),
              ne(items.id, record.id),
              outsideSourceCollection,
              or(sql`${sharesPrimaryPerson} = 1`, sql`${sharesGenre} = 1`)
            )
          )
          .orderBy(
            desc(sharesPrimaryPerson),
            desc(sharesGenre),
            asc(items.title)
          )
          .limit(12),
        db
          .select({ item: items })
          .from(items)
          .innerJoin(itemCollections, eq(itemCollections.itemId, items.id))
          .where(
            and(
              eq(
                itemCollections.collectionId,
                sql`(select collection_id from item_collections where item_id = ${record.id})`
              ),
              eq(items.status, "owned"),
              ne(items.id, record.id)
            )
          ),
      ])

    const collectionRecords = collectionRows.map((row) => row.item)
    const [item, ...related] = await enrichItems([
      record,
      ...similarRecords,
      ...collectionRecords,
    ])
    const relatedById = new Map(related.map((entry) => [entry.id, entry]))
    const partIds = item.collection?.partIds ?? null
    const partIndex = (tmdbId: string | null) =>
      partIds && tmdbId ? partIds.indexOf(tmdbId) : -1
    const collectionPart = partIndex(item.tmdbId)
    const [systemList] = systemLists

    return {
      item: {
        ...item,
        customLists: customLists.map((list) => ({
          ...list,
          containsItem: Boolean(list.containsItem),
        })),
        systemList: systemList
          ? {
              ...systemList,
              name: displayListName(systemList.slug, systemList.name),
              containsItem: Boolean(systemList.containsItem),
            }
          : null,
      },
      similarItems: similarRecords.map((row) =>
        toCatalogItem(relatedById.get(row.id)!)
      ),
      collectionItems: collectionRecords
        .map((row) => toCatalogItem(relatedById.get(row.id)!))
        .sort((left, right) =>
          partIds
            ? (partIndex(left.tmdbId) + 1 || 999) -
              (partIndex(right.tmdbId) + 1 || 999)
            : left.title.localeCompare(right.title)
        ),
      collectionPart: collectionPart >= 0 ? collectionPart : null,
      collectionPartCount: partIds?.length ?? 0,
    }
  })

export const getItemById = createServerFn({ method: "GET" })
  .inputValidator(z.object({ id: z.number().int() }))
  .handler(async ({ data }) => {
    await requireSignedIn()
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
      ...(data.type !== "book" && data.tmdbId
        ? await fetchTmdbExtras(data.type, data.tmdbId)
        : {}),
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
      if (data.type !== "book")
        await replaceItemCast(
          data.id,
          data.actors.map((name) => ({ name }))
        )
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
    if (data.type !== "book")
      await replaceItemCast(
        item.id,
        data.actors.map((name) => ({ name }))
      )
    return item
  })

export const deleteItem = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.number().int() }))
  .handler(async ({ data }) => {
    await requireSignedIn()
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
    const {
      clearLoginFailures,
      DUMMY_PASSWORD_HASH,
      loginLockoutSeconds,
      passwordsMatch,
      recordLoginFailure,
      startBootstrapSession,
      startUserSession,
      verifyStoredPassword,
    } = await import("./auth")
    const wrongPassword = {
      ok: false,
      error: "That password doesn’t open this shelf.",
    }
    const lockedOut = (seconds: number) => ({
      ok: false,
      error: `Too many attempts. Try again in ${Math.max(
        1,
        Math.ceil(seconds / 60)
      )} minute${seconds > 60 ? "s" : ""}.`,
    })
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
      const wait = await loginLockoutSeconds("bootstrap")
      if (wait) return lockedOut(wait)
      if (!passwordsMatch(data.password, process.env.ADMIN_PASSWORD.trim())) {
        await recordLoginFailure("bootstrap")
        return wrongPassword
      }
      await clearLoginFailures("bootstrap")
      startBootstrapSession()
      return { ok: true, error: "" }
    }
    if (!data.email) {
      return {
        ok: false,
        error: "Enter your email and password.",
      }
    }
    const email = data.email.trim().toLowerCase()
    const key = `email:${email}`
    const wait = await loginLockoutSeconds(key)
    if (wait) return lockedOut(wait)
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1)
    const valid = await verifyStoredPassword(
      data.password,
      user?.passwordHash ?? DUMMY_PASSWORD_HASH
    )
    if (!user || !valid) {
      await recordLoginFailure(key)
      return wrongPassword
    }
    await clearLoginFailures(key)
    await startUserSession(user.id)
    return { ok: true, error: "" }
  })

export const logout = createServerFn({ method: "POST" }).handler(async () => {
  const { endSession } = await import("./auth")
  await endSession()
  return { ok: true }
})
