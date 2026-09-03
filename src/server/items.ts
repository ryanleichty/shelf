import { and, asc, desc, eq, inArray, isNull, ne, or, sql } from "drizzle-orm"
import { createServerFn } from "@tanstack/react-start"
import { getRequestHeader } from "@tanstack/react-start/server"
import { z } from "zod"
import { displayListName } from "@/lib/system-lists"
import { parseImportQuery, rankImportCandidates } from "@/lib/import-query"
import { db } from "./db"
import { fetchTmdbCollectionPartIds, fetchTmdbExtras } from "./tmdb"
import { normalizeOpenLibraryWorkKey } from "./openlibrary"
import {
  getCollectionResultById,
  lookupCollection,
  type CollectionInput,
  type LookupResult,
} from "./providers"
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
import { itemInput } from "@/lib/item-input"
import { isAgentToken, requireSignedIn } from "./auth"
import {
  replaceItemCast,
  replaceItemCreators,
  replaceItemTags,
  type Database,
} from "./item-joins"
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
  loans,
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
          const matches = await lookupCollection({
            type: data.type,
            query: title,
          })
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
            slug: await uniqueSlug(slugify(providerResult.title), data.edition),
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
  // All network work happens before the transaction opens: a stalled fetch
  // must not hold a write transaction (or leave a half-written item behind).
  const collection = result.collection ?? null
  const storedCover = (await storeCover(coverImageUrl, slug)) || null
  const partIds =
    input.type === "movie" ? await collectionPartIdsFor(collection) : null
  return db.transaction(async (tx) => {
    const [created] = await tx
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
        coverImageUrl: storedCover,
        backdropImageUrl: result.backdropImageUrl || null,
        tmdbId: input.type === "book" ? null : input.providerId,
        openLibraryKey: input.type === "book" ? input.providerId : null,
        createdAt: now,
        updatedAt: now,
      })
      .returning({ id: items.id, title: items.title, slug: items.slug })
    await replaceItemTags(
      created.id,
      { genres: result.genres, keywords: result.keywords ?? [] },
      tx
    )
    await replaceItemCreators(
      created.id,
      input.type,
      result.creatorPeople ?? creator,
      tx
    )
    if (input.type !== "book" && result.cast !== undefined)
      await replaceItemCast(
        created.id,
        result.castPeople ?? result.cast.map((name) => ({ name })),
        tx
      )
    if (input.type === "movie")
      await replaceItemCollection(created.id, collection, partIds, tx)
    return created
  })
}

// Network work that must happen before the write transaction opens.
export async function collectionPartIdsFor(collection: CollectionInput | null) {
  return collection?.tmdbCollectionId
    ? await fetchTmdbCollectionPartIds(collection.tmdbCollectionId)
    : null
}

export async function replaceItemCollection(
  itemId: number,
  collection: CollectionInput | null,
  partIds: string[] | null,
  database: Database = db
) {
  await database
    .delete(itemCollections)
    .where(eq(itemCollections.itemId, itemId))
  if (!collection) return

  const [existing] = await database
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
      await database
        .insert(collections)
        .values({
          slug: await uniqueCollectionSlug(collection.name, database),
          name: collection.name,
          tmdbCollectionId: collection.tmdbCollectionId ?? null,
          overview: collection.overview || null,
        })
        .returning({ id: collections.id })
    )[0].id

  await database
    .insert(itemCollections)
    .values({ itemId, collectionId })
    .onConflictDoNothing()
  if (partIds?.length && !existing?.partIds?.length)
    await database
      .update(collections)
      .set({ partIds })
      .where(eq(collections.id, collectionId))
}

async function uniqueCollectionSlug(name: string, database: Database = db) {
  const baseSlug = slugify(name)
  for (let suffix = 1; ; suffix++) {
    const slug = suffix === 1 ? baseSlug : `${baseSlug}-${suffix}`
    const [existing] = await database
      .select({ id: collections.id })
      .from(collections)
      .where(eq(collections.slug, slug))
      .limit(1)
    if (!existing) return slug
  }
}

export async function enrichItems(records: ItemRecord[]): Promise<Item[]> {
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
    openLoanRows,
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
    db
      .select({
        itemId: loans.itemId,
        borrowerName: loans.borrowerName,
        dueAt: loans.dueAt,
      })
      .from(loans)
      .where(and(inArray(loans.itemId, itemIds), isNull(loans.returnedAt))),
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
  const openLoanByItem = new Map(
    openLoanRows.map(({ itemId, ...loan }) => [itemId, loan])
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
    borrower: openLoanByItem.get(item.id)?.borrowerName ?? null,
    loanDueAt: openLoanByItem.get(item.id)?.dueAt ?? null,
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
    borrower: item.borrower ?? null,
    loanDueAt: item.loanDueAt ?? null,
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

    const [customLists, systemLists, similarRecords, collectionRows, loanRows] =
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
        db
          .select({
            borrowerName: loans.borrowerName,
            borrowerUserId: loans.borrowerUserId,
            lentAt: loans.lentAt,
            dueAt: loans.dueAt,
            returnedAt: loans.returnedAt,
          })
          .from(loans)
          .where(eq(loans.itemId, record.id))
          .orderBy(desc(loans.lentAt)),
      ])

    const { isSignedIn } = await import("./auth")
    const signedIn = await isSignedIn()
    const itemLoans = signedIn
      ? loanRows
      : loanRows.filter((loan) => loan.returnedAt === null)

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
      loans: itemLoans,
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

async function assertBarcodeFree(barcode: string | null, excludeId?: number) {
  if (!barcode) return
  const [taken] = await db
    .select({ id: items.id })
    .from(items)
    .where(
      and(
        eq(items.barcode, barcode),
        excludeId ? ne(items.id, excludeId) : undefined
      )
    )
    .limit(1)
  if (taken) throw new Error("That barcode belongs to another item.")
}

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
      format: data.format?.trim() || null,
      edition: normalizeEdition(data.edition),
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
      await assertBarcodeFree(values.barcode, data.id)
      values.slug = await uniqueSlug(data.slug, data.edition, data.id)
      await db.update(items).set(values).where(eq(items.id, data.id))
      await replaceItemTags(data.id, { genres: data.genres })
      await replaceItemCreators(data.id, data.type, primaryPeople)
      if (data.type !== "book")
        await replaceItemCast(
          data.id,
          data.actors.map((name) => ({ name }))
        )
      return { id: data.id, slug: values.slug }
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
    await assertBarcodeFree(values.barcode)
    values.slug = await uniqueSlug(data.slug, data.edition)
    return db.transaction(async (tx) => {
      const [item] = await tx
        .insert(items)
        .values({ ...values, status: "owned", createdAt: now })
        .returning({ id: items.id, slug: items.slug })
      await replaceItemTags(item.id, { genres: data.genres }, tx)
      await replaceItemCreators(item.id, data.type, primaryPeople, tx)
      if (data.type !== "book")
        await replaceItemCast(
          item.id,
          data.actors.map((name) => ({ name })),
          tx
        )
      return item
    })
  })

export const deleteItem = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.number().int() }))
  .handler(async ({ data }) => {
    await requireSignedIn()
    await db.delete(listItems).where(eq(listItems.itemId, data.id))
    await db.delete(items).where(eq(items.id, data.id))
    return { ok: true }
  })
