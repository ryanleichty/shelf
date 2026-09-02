import { createClient } from "@libsql/client"
import { describe, expect, test } from "vitest"
import { SCHEMA_VERSION, readSchemaVersion, runMigrations } from "./migrate"

async function tableNames(client: ReturnType<typeof createClient>) {
  const result = await client.execute(
    "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name"
  )
  return result.rows.map((row) => String(row.name))
}

describe("runMigrations", () => {
  test("creates the schema and records the version", async () => {
    const client = createClient({ url: ":memory:" })
    expect(await readSchemaVersion(client)).toBe(0)
    await runMigrations(client)
    expect(await readSchemaVersion(client)).toBe(SCHEMA_VERSION)
    const tables = await tableNames(client)
    for (const table of [
      "items",
      "users",
      "sessions",
      "login_attempts",
      "genres",
      "item_genres",
      "authors",
      "item_authors",
      "directors",
      "item_directors",
      "actors",
      "item_actors",
      "collections",
      "item_collections",
      "lists",
      "list_items",
      "list_placements",
      "schema_meta",
    ])
      expect(tables).toContain(table)
    expect(tables).not.toContain("item_search")
  })

  test("is idempotent", async () => {
    const client = createClient({ url: ":memory:" })
    await runMigrations(client)
    await expect(runMigrations(client)).resolves.toBeUndefined()
    const lists = await client.execute(
      "SELECT slug FROM lists WHERE system = 1 ORDER BY slug"
    )
    expect(lists.rows.map((row) => row.slug)).toEqual([
      "reading-list",
      "watchlist",
    ])
  })

  test("adds the newest columns to a fresh items table", async () => {
    const client = createClient({ url: ":memory:" })
    await runMigrations(client)
    const columns = await client.execute("PRAGMA table_info(items)")
    const names = columns.rows.map((row) => row.name)
    for (const column of ["certification", "runtime", "tagline", "trailer_key"])
      expect(names).toContain(column)
  })

  test("stores a stable non-negative integer version", async () => {
    const client = createClient({ url: ":memory:" })
    await runMigrations(client)
    const stored = await client.execute(
      "SELECT value FROM schema_meta WHERE key = 'version'"
    )
    expect(Number.isInteger(SCHEMA_VERSION)).toBe(true)
    expect(SCHEMA_VERSION).toBeGreaterThan(0)
    expect(Number(stored.rows[0]?.value)).toBe(SCHEMA_VERSION)
  })

  test("readSchemaVersion rethrows errors other than a missing table", async () => {
    const client = createClient({ url: ":memory:" })
    await client.execute("CREATE TABLE schema_meta (wrong TEXT)")
    await expect(readSchemaVersion(client)).rejects.toThrow()
  })
})
