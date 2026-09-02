import { eq, inArray } from "drizzle-orm"
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

// Three statements regardless of how many names: clear the joins, upsert the
// tags in one insert, then attach them in one insert.
export async function upsertTags(
  itemId: number,
  kind: "genre" | "keyword",
  names: string[],
  database: Database = db
) {
  const rows = [
    ...new Map(
      names
        .map((name) => name.trim())
        .filter(Boolean)
        .map((name) => [slugify(name), name] as const)
        .filter(([slug]) => slug)
    ),
  ].map(([slug, name]) => ({ slug, name }))
  const slugs = rows.map((row) => row.slug)
  if (kind === "genre") {
    await database.delete(itemGenres).where(eq(itemGenres.itemId, itemId))
    if (!rows.length) return
    await database
      .insert(genres)
      .values(rows)
      .onConflictDoNothing({ target: genres.slug })
    const ids = await database
      .select({ id: genres.id })
      .from(genres)
      .where(inArray(genres.slug, slugs))
    await database
      .insert(itemGenres)
      .values(ids.map(({ id }) => ({ itemId, genreId: id })))
      .onConflictDoNothing()
  } else {
    await database.delete(itemKeywords).where(eq(itemKeywords.itemId, itemId))
    if (!rows.length) return
    await database
      .insert(keywords)
      .values(rows)
      .onConflictDoNothing({ target: keywords.slug })
    const ids = await database
      .select({ id: keywords.id })
      .from(keywords)
      .where(inArray(keywords.slug, slugs))
    await database
      .insert(itemKeywords)
      .values(ids.map(({ id }) => ({ itemId, keywordId: id })))
      .onConflictDoNothing()
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
    const id = await upsertPerson(kind, person, database)
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
    const id = await upsertPerson("actor", person, database)
    await database
      .insert(itemActors)
      .values({ itemId, actorId: id, position })
      .onConflictDoNothing()
  }
}

type PersonKind = "author" | "director" | "actor"

const personTables = {
  author: {
    table: authors,
    providerColumn: authors.openLibraryKey,
    providerField: "openLibraryKey",
  },
  director: {
    table: directors,
    providerColumn: directors.tmdbPersonId,
    providerField: "tmdbPersonId",
  },
  actor: {
    table: actors,
    providerColumn: actors.tmdbPersonId,
    providerField: "tmdbPersonId",
  },
} as const

// Matches on the provider id first, then on the slug, so a person added by
// name later picks up the provider id. The slug moves to the incoming name
// only when the stored slug still matches the stored name (nobody renamed it
// by hand) and nothing else already owns the new slug.
async function upsertPerson(
  kind: PersonKind,
  person: ProviderPerson,
  database: Database
) {
  const { table, providerColumn, providerField } = personTables[kind]
  const slug = slugify(person.name)
  if (!slug) throw new Error("Person name needs letters or numbers.")
  const columns = {
    id: table.id,
    slug: table.slug,
    name: table.name,
    providerId: providerColumn,
  }
  const [byProvider] = person.providerId
    ? await database
        .select(columns)
        .from(table)
        .where(eq(providerColumn, person.providerId))
        .limit(1)
    : []
  const [bySlug] = byProvider
    ? []
    : await database
        .select(columns)
        .from(table)
        .where(eq(table.slug, slug))
        .limit(1)
  const existing = byProvider ?? bySlug
  if (!existing) {
    const [created] = await database
      .insert(table)
      .values({
        slug,
        name: person.name,
        [providerField]: person.providerId ?? null,
      })
      .returning({ id: table.id })
    return created!.id
  }
  if (!person.providerId) return existing.id
  const reclaimSlug =
    existing.slug === slugify(existing.name) && existing.slug !== slug
  const [slugOwner] = reclaimSlug
    ? await database
        .select({ id: table.id })
        .from(table)
        .where(eq(table.slug, slug))
        .limit(1)
    : []
  await database
    .update(table)
    .set({
      name: person.name,
      ...(existing.providerId ? {} : { [providerField]: person.providerId }),
      ...(reclaimSlug && (!slugOwner || slugOwner.id === existing.id)
        ? { slug }
        : {}),
    })
    .where(eq(table.id, existing.id))
  return existing.id
}
