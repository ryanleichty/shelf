import { createServerFn } from "@tanstack/react-start"
import { and, asc, eq, gt, inArray, isNull, ne, sql } from "drizzle-orm"
import type { Catalog, CatalogItem } from "@/lib/catalog"
import { systemListSlug } from "@/lib/catalog"
import type { CurrentUser } from "./auth"
import { db } from "./db"
import type { ItemProgressState } from "@/lib/catalog"
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
  listItems,
  listPlacements,
  lists,
  loans,
  sessions,
  userItems,
  users,
} from "./schema"

function groupNames(rows: Array<{ itemId: number; name: string }>) {
  const grouped = new Map<number, string[]>()
  for (const row of rows)
    grouped.set(row.itemId, [...(grouped.get(row.itemId) ?? []), row.name])
  return grouped
}

// Everything the shell needs in one request: who is signed in plus the
// tile-level catalog every list page derives from.
export const getShell = createServerFn({ method: "GET" }).handler(async () => {
  // Imported here so node:crypto never reaches the client bundle.
  const { getSessionId, isBootstrapSession } = await import("./auth")
  const sessionId = getSessionId()
  const catalogColumns = {
    id: items.id,
    slug: items.slug,
    type: items.type,
    status: items.status,
    title: items.title,
    creator: items.creator,
    year: items.year,
    coverImageUrl: items.coverImageUrl,
    backdropImageUrl: items.backdropImageUrl,
    tmdbId: items.tmdbId,
    format: items.format,
    edition: items.edition,
    certification: items.certification,
    runtime: items.runtime,
    pageCount: items.pageCount,
    tagline: items.tagline,
    logoImageUrl: items.logoImageUrl,
    trailerKey: items.trailerKey,
    createdAt: items.createdAt,
    updatedAt: items.updatedAt,
  }
  const [
    sessionRows,
    itemRows,
    genreRows,
    authorRows,
    directorRows,
    collectionRows,
    itemCollectionRows,
    listRows,
    membershipRows,
    placementRows,
    actorRows,
    adminRows,
    openLoanRows,
    wantedRows,
  ] = await db.batch([
    db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        avatarUrl: users.avatarUrl,
        role: users.role,
      })
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .where(
        and(
          eq(sessions.id, sessionId ?? ""),
          gt(sessions.expiresAt, new Date().toISOString())
        )
      )
      .limit(1),
    db
      .select(catalogColumns)
      .from(items)
      .where(ne(items.status, "wanted"))
      .orderBy(asc(items.title)),
    db
      .select({ itemId: itemGenres.itemId, name: genres.name })
      .from(itemGenres)
      .innerJoin(genres, eq(itemGenres.genreId, genres.id)),
    db
      .select({ itemId: itemAuthors.itemId, name: authors.name })
      .from(itemAuthors)
      .innerJoin(authors, eq(itemAuthors.authorId, authors.id)),
    db
      .select({ itemId: itemDirectors.itemId, name: directors.name })
      .from(itemDirectors)
      .innerJoin(directors, eq(itemDirectors.directorId, directors.id)),
    db.select().from(collections),
    db
      .select({
        itemId: itemCollections.itemId,
        collectionId: itemCollections.collectionId,
      })
      .from(itemCollections),
    db
      .select({
        id: lists.id,
        slug: lists.slug,
        name: lists.name,
        system: lists.system,
      })
      .from(lists),
    db
      .select({
        listId: listItems.listId,
        itemId: listItems.itemId,
        position: listItems.position,
      })
      .from(listItems),
    db
      .select({
        id: listPlacements.id,
        listId: listPlacements.listId,
        kind: listPlacements.kind,
        sourceSlug: listPlacements.sourceSlug,
        type: listPlacements.type,
        position: listPlacements.position,
        visible: listPlacements.visible,
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
      })
      .from(listPlacements)
      .leftJoin(lists, eq(listPlacements.listId, lists.id))
      .orderBy(asc(listPlacements.type), asc(listPlacements.position)),
    db
      .select({ slug: actors.slug, itemId: itemActors.itemId })
      .from(itemActors)
      .innerJoin(actors, eq(itemActors.actorId, actors.id))
      .where(
        inArray(
          actors.slug,
          db
            .select({ slug: listPlacements.sourceSlug })
            .from(listPlacements)
            .where(eq(listPlacements.kind, "actor"))
        )
      ),
    db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.role, "admin"))
      .limit(1),
    db
      .select({
        itemId: loans.itemId,
        borrowerName: loans.borrowerName,
        dueAt: loans.dueAt,
      })
      .from(loans)
      .where(isNull(loans.returnedAt)),
    db
      .select(catalogColumns)
      .from(items)
      .where(eq(items.status, "wanted"))
      .orderBy(asc(items.title)),
  ])

  const genreNames = groupNames(genreRows)
  const authorNames = groupNames(authorRows)
  const directorNames = groupNames(directorRows)
  const collectionByItem = new Map(
    itemCollectionRows.map((row) => [row.itemId, row.collectionId])
  )
  const openLoanByItem = new Map(
    openLoanRows.map(({ itemId, ...loan }) => [itemId, loan])
  )
  const systemListIds = new Map(
    listRows.filter((list) => list.system).map((list) => [list.slug, list.id])
  )
  const membershipKeys = new Set(
    membershipRows.map((row) => `${row.listId}:${row.itemId}`)
  )
  const actorItems: Record<string, number[]> = {}
  for (const row of actorRows) (actorItems[row.slug] ??= []).push(row.itemId)

  const currentUser: CurrentUser | null = sessionRows[0] ?? null
  // A separate query, issued only for a signed-in viewer: the user id is not
  // known until the batch above resolves, and only their own states are ever
  // sent — no other member's, and none at all for an anonymous visitor.
  const viewerStates: Record<number, ItemProgressState> = {}
  if (currentUser) {
    const stateRows = await db
      .select({ itemId: userItems.itemId, state: userItems.state })
      .from(userItems)
      .where(eq(userItems.userId, currentUser.id))
    for (const row of stateRows) viewerStates[row.itemId] = row.state
  }

  const toCatalogItem = (row: (typeof itemRows)[number]): CatalogItem => ({
    ...row,
    genres: genreNames.get(row.id) ?? [],
    authors: authorNames.get(row.id) ?? [],
    directors: directorNames.get(row.id) ?? [],
    collectionId: collectionByItem.get(row.id) ?? null,
    isInSystemList: membershipKeys.has(
      `${systemListIds.get(systemListSlug(row.type))}:${row.id}`
    ),
    borrower: openLoanByItem.get(row.id)?.borrowerName ?? null,
    loanDueAt: openLoanByItem.get(row.id)?.dueAt ?? null,
  })

  const catalog: Catalog = {
    items: itemRows.map(toCatalogItem),
    wishlist: wantedRows.map(toCatalogItem),
    lists: listRows,
    memberships: membershipRows,
    placements: placementRows,
    collections: collectionRows,
    actorItems,
    viewerStates,
  }

  const bootstrap =
    !currentUser && !adminRows.length ? await isBootstrapSession() : false
  return { currentUser, signedIn: Boolean(currentUser) || bootstrap, catalog }
})
