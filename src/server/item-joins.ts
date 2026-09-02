import { eq } from "drizzle-orm"
import { parseCreatorNames, slugify } from "@/lib/catalog"
import { db } from "./db"
import {
  actors,
  authors,
  directors,
  genres,
  itemActors,
  itemAuthors,
  itemDirectors,
  itemGenres,
  itemKeywords,
  keywords,
  type Item,
} from "./schema"

export type ProviderPerson = {
  name: string
  providerId?: string
}

// Any drizzle instance: the shared `db`, a test database, or a transaction.
export type Database = Pick<
  typeof db,
  "select" | "insert" | "update" | "delete"
>

type TagKind = "genre" | "keyword" | "author" | "director"

export async function upsertTags(
  itemId: number,
  kind: TagKind,
  names: string[],
  database: Database = db
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
  await database.delete(joins).where(eq(joins.itemId, itemId))
  for (const name of normalized) {
    const slug = slugify(name)
    if (!slug) continue
    await database
      .insert(table)
      .values({ slug, name })
      .onConflictDoNothing({ target: table.slug })
    const [tag] = await database
      .select({ id: table.id })
      .from(table)
      .where(eq(table.slug, slug))
    if (!tag) continue
    if (kind === "genre") {
      await database
        .insert(itemGenres)
        .values({ itemId, genreId: tag.id })
        .onConflictDoNothing()
    } else if (kind === "keyword") {
      await database
        .insert(itemKeywords)
        .values({ itemId, keywordId: tag.id })
        .onConflictDoNothing()
    } else if (kind === "author") {
      await database
        .insert(itemAuthors)
        .values({ itemId, authorId: tag.id })
        .onConflictDoNothing()
    } else {
      await database
        .insert(itemDirectors)
        .values({ itemId, directorId: tag.id })
        .onConflictDoNothing()
    }
  }
}

export async function replaceItemTags(
  itemId: number,
  tags: { genres?: string[]; keywords?: string[] },
  database: Database = db
) {
  if (tags.genres !== undefined)
    await upsertTags(itemId, "genre", tags.genres, database)
  if (tags.keywords !== undefined)
    await upsertTags(itemId, "keyword", tags.keywords, database)
}

export async function replaceItemCreators(
  itemId: number,
  type: Item["type"],
  creators: string | string[] | ProviderPerson[],
  database: Database = db
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
  await database
    .delete(kind === "author" ? itemAuthors : itemDirectors)
    .where(
      eq(kind === "author" ? itemAuthors.itemId : itemDirectors.itemId, itemId)
    )
  for (const person of normalized) {
    const id =
      kind === "author"
        ? await upsertAuthor(person, database)
        : await upsertDirector(person, database)
    if (kind === "author")
      await database
        .insert(itemAuthors)
        .values({ itemId, authorId: id })
        .onConflictDoNothing()
    else
      await database
        .insert(itemDirectors)
        .values({ itemId, directorId: id })
        .onConflictDoNothing()
  }
}

export async function replaceItemCast(
  itemId: number,
  people: ProviderPerson[],
  database: Database = db
) {
  const normalized = [
    ...new Map(
      people
        .map((person) => ({ ...person, name: person.name.trim() }))
        .filter((person) => person.name)
        .map((person) => [person.providerId ?? person.name, person])
    ).values(),
  ]
  await database.delete(itemActors).where(eq(itemActors.itemId, itemId))
  for (const [position, person] of normalized.entries()) {
    const id = await upsertActor(person, database)
    await database
      .insert(itemActors)
      .values({ itemId, actorId: id, position })
      .onConflictDoNothing()
  }
}

async function upsertAuthor(person: ProviderPerson, database: Database) {
  const slug = slugify(person.name)
  if (!slug) throw new Error("Person name needs letters or numbers.")
  const [byProvider] = person.providerId
    ? await database
        .select()
        .from(authors)
        .where(eq(authors.openLibraryKey, person.providerId))
        .limit(1)
    : []
  const [bySlug] = byProvider
    ? []
    : await database
        .select()
        .from(authors)
        .where(eq(authors.slug, slug))
        .limit(1)
  const existing = byProvider ?? bySlug
  if (existing) {
    const [slugOwner] =
      person.providerId &&
      existing.slug === slugify(existing.name) &&
      existing.slug !== slug
        ? await database
            .select({ id: authors.id })
            .from(authors)
            .where(eq(authors.slug, slug))
            .limit(1)
        : []
    await database
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
  const [created] = await database
    .insert(authors)
    .values({
      slug,
      name: person.name,
      openLibraryKey: person.providerId ?? null,
    })
    .returning({ id: authors.id })
  return created.id
}

async function upsertDirector(person: ProviderPerson, database: Database) {
  const slug = slugify(person.name)
  if (!slug) throw new Error("Person name needs letters or numbers.")
  const [byProvider] = person.providerId
    ? await database
        .select()
        .from(directors)
        .where(eq(directors.tmdbPersonId, person.providerId))
        .limit(1)
    : []
  const [bySlug] = byProvider
    ? []
    : await database
        .select()
        .from(directors)
        .where(eq(directors.slug, slug))
        .limit(1)
  const existing = byProvider ?? bySlug
  if (existing) {
    const [slugOwner] =
      person.providerId &&
      existing.slug === slugify(existing.name) &&
      existing.slug !== slug
        ? await database
            .select({ id: directors.id })
            .from(directors)
            .where(eq(directors.slug, slug))
            .limit(1)
        : []
    await database
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
  const [created] = await database
    .insert(directors)
    .values({
      slug,
      name: person.name,
      tmdbPersonId: person.providerId ?? null,
    })
    .returning({ id: directors.id })
  return created.id
}

async function upsertActor(person: ProviderPerson, database: Database) {
  const slug = slugify(person.name)
  if (!slug) throw new Error("Person name needs letters or numbers.")
  const [byProvider] = person.providerId
    ? await database
        .select()
        .from(actors)
        .where(eq(actors.tmdbPersonId, person.providerId))
        .limit(1)
    : []
  const [bySlug] = byProvider
    ? []
    : await database.select().from(actors).where(eq(actors.slug, slug)).limit(1)
  const existing = byProvider ?? bySlug
  if (existing) {
    const [slugOwner] =
      person.providerId &&
      existing.slug === slugify(existing.name) &&
      existing.slug !== slug
        ? await database
            .select({ id: actors.id })
            .from(actors)
            .where(eq(actors.slug, slug))
            .limit(1)
        : []
    await database
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
  const [created] = await database
    .insert(actors)
    .values({
      slug,
      name: person.name,
      tmdbPersonId: person.providerId ?? null,
    })
    .returning({ id: actors.id })
  return created.id
}
