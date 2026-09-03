import { createClient } from "@libsql/client"
import { describe, expect, test } from "vitest"
import { runMigrations } from "./migrate"

async function seedItemAndUser(client: ReturnType<typeof createClient>) {
  await client.execute(
    "INSERT INTO items (slug, type, status, title, creator, year, created_at, updated_at) VALUES ('item-1', 'book', 'owned', 'Item', 'Someone', 2000, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')"
  )
  await client.execute(
    "INSERT INTO users (first_name, last_name, email, role, password_hash, created_at, updated_at) VALUES ('Dana', 'Smith', 'dana@example.com', 'member', 'hash', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')"
  )
}

describe("the loans_open_item_unique invariant", () => {
  test("a second open loan for the same item violates the unique index", async () => {
    const client = createClient({ url: ":memory:" })
    await runMigrations(client)
    await seedItemAndUser(client)
    await client.execute(
      "INSERT INTO loans (item_id, borrower_name, lent_at, created_at) VALUES (1, 'Dana', '2026-01-01', '2026-01-01T00:00:00.000Z')"
    )
    await expect(
      client.execute(
        "INSERT INTO loans (item_id, borrower_name, lent_at, created_at) VALUES (1, 'Marcus', '2026-01-02', '2026-01-02T00:00:00.000Z')"
      )
    ).rejects.toThrow(/UNIQUE/)
  })

  test("a second loan succeeds once the first is returned", async () => {
    const client = createClient({ url: ":memory:" })
    await runMigrations(client)
    await seedItemAndUser(client)
    await client.execute(
      "INSERT INTO loans (item_id, borrower_name, lent_at, returned_at, created_at) VALUES (1, 'Dana', '2026-01-01', '2026-01-05', '2026-01-01T00:00:00.000Z')"
    )
    await client.execute(
      "INSERT INTO loans (item_id, borrower_name, lent_at, created_at) VALUES (1, 'Marcus', '2026-01-06', '2026-01-06T00:00:00.000Z')"
    )
    const openLoans = await client.execute(
      "SELECT borrower_name FROM loans WHERE item_id = 1 AND returned_at IS NULL"
    )
    expect(openLoans.rows).toHaveLength(1)
    expect(openLoans.rows[0]?.borrower_name).toBe("Marcus")
  })
})

describe("loan foreign keys", () => {
  test("deleting the borrower's user row clears borrower_user_id but keeps borrower_name", async () => {
    const client = createClient({ url: ":memory:" })
    await client.execute("PRAGMA foreign_keys = ON")
    await runMigrations(client)
    await seedItemAndUser(client)
    await client.execute(
      "INSERT INTO loans (item_id, borrower_user_id, borrower_name, lent_at, created_at) VALUES (1, 1, 'Dana', '2026-01-01', '2026-01-01T00:00:00.000Z')"
    )
    await client.execute("DELETE FROM users WHERE id = 1")
    const loan = await client.execute(
      "SELECT borrower_user_id, borrower_name FROM loans WHERE item_id = 1"
    )
    expect(loan.rows).toHaveLength(1)
    expect(loan.rows[0]?.borrower_user_id).toBeNull()
    expect(loan.rows[0]?.borrower_name).toBe("Dana")
  })

  test("deleting the item cascades its loans away", async () => {
    const client = createClient({ url: ":memory:" })
    await client.execute("PRAGMA foreign_keys = ON")
    await runMigrations(client)
    await seedItemAndUser(client)
    await client.execute(
      "INSERT INTO loans (item_id, borrower_name, lent_at, created_at) VALUES (1, 'Dana', '2026-01-01', '2026-01-01T00:00:00.000Z')"
    )
    await client.execute("DELETE FROM items WHERE id = 1")
    const loans = await client.execute("SELECT id FROM loans WHERE item_id = 1")
    expect(loans.rows).toHaveLength(0)
  })
})
