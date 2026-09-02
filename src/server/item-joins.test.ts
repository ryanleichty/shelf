import { createClient } from "@libsql/client"
import { drizzle } from "drizzle-orm/libsql"
import { beforeEach, describe, expect, test } from "vitest"
import {
  itemCast,
  itemCreators,
  replaceItemCast,
  replaceItemCreators,
  samePeople,
  upsertTags,
} from "./item-joins"
import { runMigrations } from "./migrate"
import * as schema from "./schema"

let client: ReturnType<typeof createClient>
let database: ReturnType<typeof drizzle<typeof schema>>
let itemId: number

beforeEach(async () => {
  client = createClient({ url: ":memory:" })
  await runMigrations(client)
  database = drizzle({ client, schema })
  const now = new Date().toISOString()
  const [item] = await database
    .insert(schema.items)
    .values({
      slug: "dune",
      type: "movie",
      title: "Dune",
      creator: "Denis Villeneuve",
      year: 2021,
      createdAt: now,
      updatedAt: now,
    })
    .returning({ id: schema.items.id })
  itemId = item!.id
})

describe("upsertTags", () => {
  test("dedupes, trims and replaces genres", async () => {
    await upsertTags(
      itemId,
      "genre",
      [" Drama", "drama", "Sci-Fi", ""],
      database
    )
    let rows = await client.execute(
      "SELECT g.slug FROM item_genres ig JOIN genres g ON g.id = ig.genre_id ORDER BY g.slug"
    )
    expect(rows.rows.map((r) => r.slug)).toEqual(["drama", "sci-fi"])
    await upsertTags(itemId, "genre", ["Drama"], database)
    rows = await client.execute("SELECT COUNT(*) AS n FROM item_genres")
    expect(Number(rows.rows[0]?.n)).toBe(1)
  })
})

describe("replaceItemCreators", () => {
  test("matches by provider id and attaches it to an existing slug-only person", async () => {
    await replaceItemCreators(itemId, "movie", "Denis Villeneuve", database)
    await replaceItemCreators(
      itemId,
      "movie",
      [{ name: "Denis Villeneuve", providerId: "137427" }],
      database
    )
    const rows = await client.execute(
      "SELECT name, tmdb_person_id FROM directors"
    )
    expect(rows.rows).toHaveLength(1)
    expect(rows.rows[0]?.tmdb_person_id).toBe("137427")
  })
})

describe("replaceItemCast", () => {
  test("stores positions in order and replaces on re-run", async () => {
    await replaceItemCast(itemId, [{ name: "A" }, { name: "B" }], database)
    await replaceItemCast(itemId, [{ name: "B" }], database)
    const rows = await client.execute(
      "SELECT a.name, ia.position FROM item_actors ia JOIN actors a ON a.id = ia.actor_id"
    )
    expect(rows.rows.map((r) => [r.name, Number(r.position)])).toEqual([
      ["B", 0],
    ])
  })
})

describe("itemCreators and itemCast", () => {
  test("read back the people a sync just wrote, in write order", async () => {
    await replaceItemCreators(
      itemId,
      "movie",
      [{ name: "Zed" }, { name: "Abe", providerId: "9" }],
      database
    )
    await replaceItemCast(itemId, [{ name: "Zed" }, { name: "Abe" }], database)
    const creators = await itemCreators(itemId, "movie", database)
    expect(creators).toEqual([
      { name: "Zed", providerId: null },
      { name: "Abe", providerId: "9" },
    ])
    expect(samePeople(creators, [{ name: "Zed" }, { name: "Abe" }])).toBe(true)
    expect(await itemCast(itemId, database)).toEqual([
      { name: "Zed", providerId: null },
      { name: "Abe", providerId: null },
    ])
  })
})

describe("samePeople", () => {
  test("compares by provider id, then slugified name, in order", () => {
    const current = [
      { name: "A", providerId: "1" },
      { name: "B", providerId: null },
    ]
    expect(samePeople(current, undefined)).toBe(true)
    expect(
      samePeople(current, [{ name: "A", providerId: "1" }, { name: "b" }])
    ).toBe(true)
    expect(
      samePeople(current, [{ name: "B" }, { name: "A", providerId: "1" }])
    ).toBe(false)
    expect(
      samePeople(current, [{ name: "A", providerId: "2" }, { name: "B" }])
    ).toBe(false)
  })
})
