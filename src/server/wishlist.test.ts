import { createClient } from "@libsql/client"
import { describe, expect, test } from "vitest"
import { runMigrations } from "./migrate"

async function insertItem(
  client: ReturnType<typeof createClient>,
  slug: string,
  status: "owned" | "borrowed" | "wanted"
) {
  await client.execute({
    sql: "INSERT INTO items (slug, type, status, title, creator, year, created_at, updated_at) VALUES (?, 'book', ?, ?, 'Someone', 2000, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')",
    args: [slug, status, slug],
  })
}

describe("the getShell partition predicate", () => {
  test("status != 'wanted' returns owned and borrowed rows; status = 'wanted' returns only the wanted row", async () => {
    const client = createClient({ url: ":memory:" })
    await runMigrations(client)
    await insertItem(client, "owned-item", "owned")
    await insertItem(client, "borrowed-item", "borrowed")
    await insertItem(client, "wanted-item", "wanted")

    const notWanted = await client.execute(
      "SELECT slug FROM items WHERE status != 'wanted' ORDER BY slug"
    )
    expect(notWanted.rows.map((row) => row.slug)).toEqual([
      "borrowed-item",
      "owned-item",
    ])

    const wanted = await client.execute(
      "SELECT slug FROM items WHERE status = 'wanted'"
    )
    expect(wanted.rows.map((row) => row.slug)).toEqual(["wanted-item"])
  })
})

describe("no migration is needed for the wanted status", () => {
  test("a fresh database accepts status = 'wanted' with no CHECK constraint", async () => {
    const client = createClient({ url: ":memory:" })
    await runMigrations(client)
    await expect(
      insertItem(client, "wanted-item", "wanted")
    ).resolves.not.toThrow()
    const row = await client.execute(
      "SELECT status FROM items WHERE slug = 'wanted-item'"
    )
    expect(row.rows[0]?.status).toBe("wanted")
  })
})

describe("a wanted item carries no loan", () => {
  test("owned and wanted items coexist, and the wanted row has no open loan", async () => {
    const client = createClient({ url: ":memory:" })
    await runMigrations(client)
    await insertItem(client, "owned-item", "owned")
    await insertItem(client, "wanted-item", "wanted")

    const items = await client.execute("SELECT slug FROM items ORDER BY slug")
    expect(items.rows.map((row) => row.slug)).toEqual([
      "owned-item",
      "wanted-item",
    ])

    const wantedId = (
      await client.execute("SELECT id FROM items WHERE slug = 'wanted-item'")
    ).rows[0]?.id
    const loans = await client.execute({
      sql: "SELECT id FROM loans WHERE item_id = ?",
      args: [wantedId as number],
    })
    expect(loans.rows).toHaveLength(0)
  })
})

describe("the person page join predicate", () => {
  test("an author is only found through items the catalog can show", async () => {
    const client = createClient({ url: ":memory:" })
    await runMigrations(client)
    await insertItem(client, "owned-book", "owned")
    await insertItem(client, "wanted-book", "wanted")
    await client.execute(
      "INSERT INTO authors (slug, name) VALUES ('kept', 'Kept'), ('wishlist-only', 'Wishlist Only')"
    )
    await client.execute(`
      INSERT INTO item_authors (item_id, author_id)
      SELECT i.id, a.id FROM items i, authors a
      WHERE (i.slug = 'owned-book' AND a.slug = 'kept')
         OR (i.slug = 'wanted-book' AND a.slug = 'wishlist-only')
    `)

    const rowsFor = async (slug: string) =>
      (
        await client.execute({
          sql: `
            SELECT ia.item_id FROM authors a
            JOIN item_authors ia ON ia.author_id = a.id
            JOIN items i ON i.id = ia.item_id AND i.status != 'wanted'
            WHERE a.slug = ?
          `,
          args: [slug],
        })
      ).rows

    expect(await rowsFor("kept")).toHaveLength(1)
    expect(await rowsFor("wishlist-only")).toHaveLength(0)
  })
})
