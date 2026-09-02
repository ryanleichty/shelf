import { asc, eq, sql } from "drizzle-orm"
import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { requireAdmin } from "./auth"
import { db } from "./db"
import {
  actors,
  authors,
  directors,
  itemActors,
  itemAuthors,
  itemDirectors,
} from "./schema"

const personKinds = ["author", "director", "actor"] as const
export type PersonKind = (typeof personKinds)[number]

const personInput = z.object({
  kind: z.enum(personKinds),
  id: z.number().int(),
  name: z.string().trim().min(1).max(240),
  slug: z.string().trim().min(1).max(240),
})

const personIdInput = z.object({
  kind: z.enum(personKinds),
  id: z.number().int(),
})

export type Person = {
  id: number
  name: string
  slug: string
  itemCount: number
}

async function peopleFor(kind: PersonKind): Promise<Person[]> {
  const table =
    kind === "author" ? authors : kind === "director" ? directors : actors
  const joins =
    kind === "author"
      ? itemAuthors
      : kind === "director"
        ? itemDirectors
        : itemActors
  const personId =
    kind === "author"
      ? itemAuthors.authorId
      : kind === "director"
        ? itemDirectors.directorId
        : itemActors.actorId
  return db
    .select({
      id: table.id,
      name: table.name,
      slug: table.slug,
      itemCount: sql<number>`count(${personId})`,
    })
    .from(table)
    .leftJoin(joins, eq(table.id, personId))
    .groupBy(table.id)
    .orderBy(asc(table.name))
}

export const getPeople = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin()
  const [authorPeople, directorPeople, actorPeople] = await Promise.all(
    personKinds.map((kind) => peopleFor(kind))
  )
  return {
    authors: authorPeople,
    directors: directorPeople,
    actors: actorPeople,
  }
})

export const savePerson = createServerFn({ method: "POST" })
  .inputValidator(personInput)
  .handler(async ({ data }) => {
    await requireAdmin()
    const table =
      data.kind === "author"
        ? authors
        : data.kind === "director"
          ? directors
          : actors
    const [slugOwner] = await db
      .select({ id: table.id })
      .from(table)
      .where(eq(table.slug, data.slug))
      .limit(1)
    if (slugOwner && slugOwner.id !== data.id)
      throw new Error("That slug is already in use.")
    const [person] = await db
      .select({ id: table.id })
      .from(table)
      .where(eq(table.id, data.id))
      .limit(1)
    if (!person) throw new Error("Person not found.")
    await db
      .update(table)
      .set({ name: data.name, slug: data.slug })
      .where(eq(table.id, data.id))
    return { ok: true }
  })

export const deletePerson = createServerFn({ method: "POST" })
  .inputValidator(personIdInput)
  .handler(async ({ data }) => {
    await requireAdmin()
    const people = await peopleFor(data.kind)
    const person = people.find((candidate) => candidate.id === data.id)
    if (!person) return { ok: true }
    if (person.itemCount)
      throw new Error("People linked to items must be merged instead.")
    const table =
      data.kind === "author"
        ? authors
        : data.kind === "director"
          ? directors
          : actors
    await db.delete(table).where(eq(table.id, data.id))
    return { ok: true }
  })

export const mergePeople = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      kind: z.enum(personKinds),
      sourceId: z.number().int(),
      survivorId: z.number().int(),
    })
  )
  .handler(async ({ data }) => {
    await requireAdmin()
    if (data.sourceId === data.survivorId)
      throw new Error("Choose a different person to merge into.")

    if (data.kind === "author") {
      await mergeAuthors(data.sourceId, data.survivorId)
    } else if (data.kind === "director") {
      await mergeDirectors(data.sourceId, data.survivorId)
    } else {
      await mergeActors(data.sourceId, data.survivorId)
    }
    return { ok: true }
  })

async function mergeAuthors(sourceId: number, survivorId: number) {
  await db.transaction(async (tx) => {
    const [source] = await tx
      .select()
      .from(authors)
      .where(eq(authors.id, sourceId))
      .limit(1)
    const [survivor] = await tx
      .select()
      .from(authors)
      .where(eq(authors.id, survivorId))
      .limit(1)
    if (!source || !survivor) throw new Error("Person not found.")
    if (source.openLibraryKey && survivor.openLibraryKey)
      throw new Error(
        "People with different provider records cannot be merged."
      )
    const sourceJoins = await tx
      .select({ itemId: itemAuthors.itemId })
      .from(itemAuthors)
      .where(eq(itemAuthors.authorId, sourceId))
    for (const join of sourceJoins)
      await tx
        .insert(itemAuthors)
        .values({ itemId: join.itemId, authorId: survivorId })
        .onConflictDoNothing()
    await tx.delete(itemAuthors).where(eq(itemAuthors.authorId, sourceId))
    await tx.delete(authors).where(eq(authors.id, sourceId))
    if (source.openLibraryKey)
      await tx
        .update(authors)
        .set({ openLibraryKey: source.openLibraryKey })
        .where(eq(authors.id, survivorId))
  })
}

async function mergeDirectors(sourceId: number, survivorId: number) {
  await db.transaction(async (tx) => {
    const [source] = await tx
      .select()
      .from(directors)
      .where(eq(directors.id, sourceId))
      .limit(1)
    const [survivor] = await tx
      .select()
      .from(directors)
      .where(eq(directors.id, survivorId))
      .limit(1)
    if (!source || !survivor) throw new Error("Person not found.")
    if (source.tmdbPersonId && survivor.tmdbPersonId)
      throw new Error(
        "People with different provider records cannot be merged."
      )
    const sourceJoins = await tx
      .select({ itemId: itemDirectors.itemId })
      .from(itemDirectors)
      .where(eq(itemDirectors.directorId, sourceId))
    for (const join of sourceJoins)
      await tx
        .insert(itemDirectors)
        .values({ itemId: join.itemId, directorId: survivorId })
        .onConflictDoNothing()
    await tx.delete(itemDirectors).where(eq(itemDirectors.directorId, sourceId))
    await tx.delete(directors).where(eq(directors.id, sourceId))
    if (source.tmdbPersonId)
      await tx
        .update(directors)
        .set({ tmdbPersonId: source.tmdbPersonId })
        .where(eq(directors.id, survivorId))
  })
}

async function mergeActors(sourceId: number, survivorId: number) {
  await db.transaction(async (tx) => {
    const [source] = await tx
      .select()
      .from(actors)
      .where(eq(actors.id, sourceId))
      .limit(1)
    const [survivor] = await tx
      .select()
      .from(actors)
      .where(eq(actors.id, survivorId))
      .limit(1)
    if (!source || !survivor) throw new Error("Person not found.")
    if (source.tmdbPersonId && survivor.tmdbPersonId)
      throw new Error(
        "People with different provider records cannot be merged."
      )
    const sourceJoins = await tx
      .select({ itemId: itemActors.itemId, position: itemActors.position })
      .from(itemActors)
      .where(eq(itemActors.actorId, sourceId))
    for (const join of sourceJoins)
      await tx
        .insert(itemActors)
        .values({
          itemId: join.itemId,
          actorId: survivorId,
          position: join.position,
        })
        .onConflictDoNothing()
    await tx.delete(itemActors).where(eq(itemActors.actorId, sourceId))
    await tx.delete(actors).where(eq(actors.id, sourceId))
    if (source.tmdbPersonId)
      await tx
        .update(actors)
        .set({ tmdbPersonId: source.tmdbPersonId })
        .where(eq(actors.id, survivorId))
  })
}
