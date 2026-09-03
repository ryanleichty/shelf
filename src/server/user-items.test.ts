import { createClient } from "@libsql/client"
import { describe, expect, test } from "vitest"
import { runMigrations } from "./migrate"

async function seedItemAndUsers(client: ReturnType<typeof createClient>) {
  await client.execute(
    "INSERT INTO items (id, slug, type, status, title, creator, year, created_at, updated_at) VALUES (1, 'item-1', 'book', 'owned', 'Item', 'Someone', 2000, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')"
  )
  await client.execute(
    "INSERT INTO users (id, first_name, last_name, email, role, password_hash, created_at, updated_at) VALUES (1, 'Dana', 'Smith', 'dana@example.com', 'member', 'hash', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')"
  )
  await client.execute(
    "INSERT INTO users (id, first_name, last_name, email, role, password_hash, created_at, updated_at) VALUES (2, 'Marcus', 'Lee', 'marcus@example.com', 'member', 'hash', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')"
  )
}

describe("the user_items_user_id_item_id_unique invariant", () => {
  test("two different users can each hold a row for the same item", async () => {
    const client = createClient({ url: ":memory:" })
    await runMigrations(client)
    await seedItemAndUsers(client)
    await client.execute(
      "INSERT INTO user_items (user_id, item_id, state, started_at, updated_at) VALUES (1, 1, 'reading', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')"
    )
    await client.execute(
      "INSERT INTO user_items (user_id, item_id, state, started_at, updated_at) VALUES (2, 1, 'reading', '2026-01-02T00:00:00.000Z', '2026-01-02T00:00:00.000Z')"
    )
    const rows = await client.execute(
      "SELECT user_id FROM user_items WHERE item_id = 1 ORDER BY user_id"
    )
    expect(rows.rows.map((row) => row.user_id)).toEqual([1, 2])
  })

  test("the same user cannot hold two rows for one item", async () => {
    const client = createClient({ url: ":memory:" })
    await runMigrations(client)
    await seedItemAndUsers(client)
    await client.execute(
      "INSERT INTO user_items (user_id, item_id, state, started_at, updated_at) VALUES (1, 1, 'reading', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')"
    )
    await expect(
      client.execute(
        "INSERT INTO user_items (user_id, item_id, state, started_at, updated_at) VALUES (1, 1, 'reading', '2026-01-02T00:00:00.000Z', '2026-01-02T00:00:00.000Z')"
      )
    ).rejects.toThrow(/UNIQUE/)
  })

  test("an upsert on conflict changes state and leaves started_at untouched", async () => {
    const client = createClient({ url: ":memory:" })
    await runMigrations(client)
    await seedItemAndUsers(client)
    await client.execute(
      "INSERT INTO user_items (user_id, item_id, state, started_at, updated_at) VALUES (1, 1, 'reading', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')"
    )
    await client.execute(`
      INSERT INTO user_items (user_id, item_id, state, started_at, updated_at)
      VALUES (1, 1, 'watching', '2026-02-01T00:00:00.000Z', '2026-02-01T00:00:00.000Z')
      ON CONFLICT(user_id, item_id) DO UPDATE SET
        state = excluded.state,
        updated_at = excluded.updated_at
    `)
    const row = await client.execute(
      "SELECT state, started_at, updated_at FROM user_items WHERE user_id = 1 AND item_id = 1"
    )
    expect(row.rows[0]?.state).toBe("watching")
    expect(row.rows[0]?.started_at).toBe("2026-01-01T00:00:00.000Z")
    expect(row.rows[0]?.updated_at).toBe("2026-02-01T00:00:00.000Z")
  })
})

describe("user_items foreign keys", () => {
  test("deleting a user removes their rows", async () => {
    const client = createClient({ url: ":memory:" })
    await client.execute("PRAGMA foreign_keys = ON")
    await runMigrations(client)
    await seedItemAndUsers(client)
    await client.execute(
      "INSERT INTO user_items (user_id, item_id, state, started_at, updated_at) VALUES (1, 1, 'reading', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')"
    )
    await client.execute("DELETE FROM users WHERE id = 1")
    const rows = await client.execute(
      "SELECT id FROM user_items WHERE user_id = 1"
    )
    expect(rows.rows).toHaveLength(0)
  })

  test("deleting an item removes every user's rows for it", async () => {
    const client = createClient({ url: ":memory:" })
    await client.execute("PRAGMA foreign_keys = ON")
    await runMigrations(client)
    await seedItemAndUsers(client)
    await client.execute(
      "INSERT INTO user_items (user_id, item_id, state, started_at, updated_at) VALUES (1, 1, 'reading', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')"
    )
    await client.execute(
      "INSERT INTO user_items (user_id, item_id, state, started_at, updated_at) VALUES (2, 1, 'reading', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')"
    )
    await client.execute("DELETE FROM items WHERE id = 1")
    const rows = await client.execute(
      "SELECT id FROM user_items WHERE item_id = 1"
    )
    expect(rows.rows).toHaveLength(0)
  })
})
