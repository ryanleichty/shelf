import { createClient } from "@libsql/client"
import { describe, expect, test } from "vitest"
import { readSchemaVersion, runMigrations, schemaVersion } from "./migrate"

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
    expect(await readSchemaVersion(client)).toBe(schemaVersion())
    const tables = await tableNames(client)
    for (const table of [
      "items",
      "users",
      "sessions",
      "login_attempts",
      "bootstrap_sessions",
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
      "loans",
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
    expect(Number.isInteger(schemaVersion())).toBe(true)
    expect(schemaVersion()).toBeGreaterThan(0)
    expect(schemaVersion()).toBe(schemaVersion())
    expect(Number(stored.rows[0]?.value)).toBe(schemaVersion())
  })

  test("bootstrap sessions expire by timestamp comparison", async () => {
    const client = createClient({ url: ":memory:" })
    await runMigrations(client)
    await client.execute(
      "INSERT INTO bootstrap_sessions (id, expires_at, created_at) VALUES ('a', '2000-01-01T00:00:00.000Z', '2000-01-01T00:00:00.000Z'), ('b', '2999-01-01T00:00:00.000Z', '2000-01-01T00:00:00.000Z')"
    )
    const live = await client.execute({
      sql: "SELECT id FROM bootstrap_sessions WHERE expires_at > ?",
      args: [new Date().toISOString()],
    })
    expect(live.rows.map((row) => row.id)).toEqual(["b"])
  })

  test("readSchemaVersion rethrows errors other than a missing table", async () => {
    const client = createClient({ url: ":memory:" })
    await client.execute("CREATE TABLE schema_meta (wrong TEXT)")
    await expect(readSchemaVersion(client)).rejects.toThrow()
  })

  test("backfills legacy borrower/loaned_at into loans, then drops the columns", async () => {
    const client = createClient({ url: ":memory:" })
    await client.execute(
      "CREATE TABLE items (id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, slug TEXT NOT NULL UNIQUE, type TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'owned', title TEXT NOT NULL, creator TEXT NOT NULL, year INTEGER NOT NULL, borrower TEXT, loaned_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)"
    )
    await client.execute(
      "INSERT INTO items (id, slug, type, status, title, creator, year, borrower, loaned_at, created_at, updated_at) VALUES (1, 'named', 'book', 'borrowed', 'Named', 'Someone', 2000, 'Dana', '2026-01-01', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')"
    )
    await client.execute(
      "INSERT INTO items (id, slug, type, status, title, creator, year, borrower, loaned_at, created_at, updated_at) VALUES (2, 'unnamed', 'book', 'borrowed', 'Unnamed', 'Someone', 2000, NULL, NULL, '2026-01-02T00:00:00.000Z', '2026-01-02T00:00:00.000Z')"
    )

    await runMigrations(client)

    const namedLoans = await client.execute(
      "SELECT borrower_name, lent_at, returned_at FROM loans WHERE item_id = 1"
    )
    expect(namedLoans.rows).toHaveLength(1)
    expect(namedLoans.rows[0]?.borrower_name).toBe("Dana")
    expect(namedLoans.rows[0]?.lent_at).toBe("2026-01-01")
    expect(namedLoans.rows[0]?.returned_at).toBeNull()
    const namedItem = await client.execute(
      "SELECT status FROM items WHERE id = 1"
    )
    expect(namedItem.rows[0]?.status).toBe("borrowed")

    const unnamedLoans = await client.execute(
      "SELECT id FROM loans WHERE item_id = 2"
    )
    expect(unnamedLoans.rows).toHaveLength(0)
    const unnamedItem = await client.execute(
      "SELECT status FROM items WHERE id = 2"
    )
    expect(unnamedItem.rows[0]?.status).toBe("owned")

    const columns = await client.execute("PRAGMA table_info(items)")
    const names = columns.rows.map((row) => row.name)
    expect(names).not.toContain("borrower")
    expect(names).not.toContain("loaned_at")

    await expect(runMigrations(client)).resolves.toBeUndefined()
    const allLoans = await client.execute("SELECT id FROM loans")
    expect(allLoans.rows).toHaveLength(1)
  })
})
