import { createClient } from "@libsql/client"

const client = createClient({
  url: process.env.TURSO_DATABASE_URL ?? "file:/tmp/shelf.db",
  authToken: process.env.TURSO_AUTH_TOKEN,
})

await client.execute(`
  CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'owned',
    title TEXT NOT NULL,
    creator TEXT NOT NULL,
    year INTEGER NOT NULL,
    cover_image_url TEXT,
    open_library_key TEXT,
    tmdb_id TEXT,
    borrower TEXT,
    loaned_at TEXT,
    format TEXT,
    edition TEXT,
    genres TEXT NOT NULL DEFAULT '[]',
    notes TEXT NOT NULL DEFAULT '',
    acquired_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )
`)
const columns = await client.execute("PRAGMA table_info(items)")
if (!columns.rows.some((column) => column.name === "status")) {
  await client.execute(
    "ALTER TABLE items ADD COLUMN status TEXT NOT NULL DEFAULT 'owned'"
  )
}
if (!columns.rows.some((column) => column.name === "open_library_key")) {
  await client.execute("ALTER TABLE items ADD COLUMN open_library_key TEXT")
}
if (!columns.rows.some((column) => column.name === "tmdb_id")) {
  await client.execute("ALTER TABLE items ADD COLUMN tmdb_id TEXT")
}
if (!columns.rows.some((column) => column.name === "borrower")) {
  await client.execute("ALTER TABLE items ADD COLUMN borrower TEXT")
}
if (!columns.rows.some((column) => column.name === "loaned_at")) {
  await client.execute("ALTER TABLE items ADD COLUMN loaned_at TEXT")
}
if (!columns.rows.some((column) => column.name === "format")) {
  await client.execute("ALTER TABLE items ADD COLUMN format TEXT")
}
if (!columns.rows.some((column) => column.name === "edition")) {
  await client.execute("ALTER TABLE items ADD COLUMN edition TEXT")
}
if (!columns.rows.some((column) => column.name === "genres")) {
  await client.execute(
    "ALTER TABLE items ADD COLUMN genres TEXT NOT NULL DEFAULT '[]'"
  )
}
if (!columns.rows.some((column) => column.name === "description")) {
  await client.execute("ALTER TABLE items ADD COLUMN description TEXT")
}
if (!columns.rows.some((column) => column.name === "certification")) {
  await client.execute("ALTER TABLE items ADD COLUMN certification TEXT")
}
if (!columns.rows.some((column) => column.name === "runtime")) {
  await client.execute("ALTER TABLE items ADD COLUMN runtime INTEGER")
}
if (!columns.rows.some((column) => column.name === "subtitle")) {
  await client.execute("ALTER TABLE items ADD COLUMN subtitle TEXT")
}
if (!columns.rows.some((column) => column.name === "page_count")) {
  await client.execute("ALTER TABLE items ADD COLUMN page_count INTEGER")
}
if (!columns.rows.some((column) => column.name === "publisher")) {
  await client.execute("ALTER TABLE items ADD COLUMN publisher TEXT")
}
if (!columns.rows.some((column) => column.name === "isbn_13")) {
  await client.execute("ALTER TABLE items ADD COLUMN isbn_13 TEXT")
}
await client.execute(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL DEFAULT 'member',
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )
`)
await client.execute(`
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL
  )
`)
await client.execute(
  "CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id)"
)
await client.execute(`
  CREATE TABLE IF NOT EXISTS genres (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL
  )
`)
await client.execute(`
  CREATE TABLE IF NOT EXISTS item_genres (
    item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    genre_id INTEGER NOT NULL REFERENCES genres(id) ON DELETE CASCADE,
    UNIQUE(item_id, genre_id)
  )
`)
await client.execute(`
  CREATE TABLE IF NOT EXISTS keywords (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL
  )
`)
await client.execute(`
  CREATE TABLE IF NOT EXISTS item_keywords (
    item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    keyword_id INTEGER NOT NULL REFERENCES keywords(id) ON DELETE CASCADE,
    UNIQUE(item_id, keyword_id)
  )
`)
await client.execute(`
  CREATE TABLE IF NOT EXISTS actors (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL
  )
`)
await client.execute(`
  CREATE TABLE IF NOT EXISTS item_actors (
    item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    actor_id INTEGER NOT NULL REFERENCES actors(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    UNIQUE(item_id, actor_id)
  )
`)
await client.execute(`
  CREATE TABLE IF NOT EXISTS collections (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    tmdb_collection_id TEXT UNIQUE,
    overview TEXT
  )
`)
await client.execute(`
  CREATE TABLE IF NOT EXISTS item_collections (
    item_id INTEGER NOT NULL UNIQUE REFERENCES items(id) ON DELETE CASCADE,
    collection_id INTEGER NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
    UNIQUE(item_id, collection_id)
  )
`)
await client.execute(`
  CREATE VIRTUAL TABLE IF NOT EXISTS item_search USING fts5(
    title, creator, description, genres, keywords
  )
`)
const legacyItems = await client.execute("SELECT id, genres FROM items")
for (const row of legacyItems.rows) {
  try {
    const names = JSON.parse(String(row.genres ?? "[]"))
    if (!Array.isArray(names)) continue
    for (const rawName of names) {
      if (typeof rawName !== "string") continue
      const name = rawName.trim()
      const slug = name
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
      if (!slug) continue
      await client.execute({
        sql: "INSERT INTO genres (slug, name) VALUES (?, ?) ON CONFLICT(slug) DO NOTHING",
        args: [slug, name],
      })
      await client.execute({
        sql: "INSERT INTO item_genres (item_id, genre_id) SELECT ?, id FROM genres WHERE slug = ? ON CONFLICT DO NOTHING",
        args: [Number(row.id), slug],
      })
    }
  } catch {
    // Ignore malformed legacy JSON.
  }
}
await client.execute("DELETE FROM item_search")
await client.execute(`
  INSERT INTO item_search (rowid, title, creator, description, genres, keywords)
  SELECT items.id, items.title, items.creator, COALESCE(items.description, ''),
    COALESCE((SELECT group_concat(genres.name, ' ') FROM item_genres JOIN genres ON genres.id = item_genres.genre_id WHERE item_genres.item_id = items.id), ''),
    COALESCE((SELECT group_concat(keywords.name, ' ') FROM item_keywords JOIN keywords ON keywords.id = item_keywords.keyword_id WHERE item_keywords.item_id = items.id), '')
  FROM items
`)
const now = new Date().toISOString()
await client.execute(`
  CREATE TABLE IF NOT EXISTS lists (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    system INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  )
`)
const listColumns = await client.execute("PRAGMA table_info(lists)")
if (!listColumns.rows.some((column) => column.name === "system")) {
  await client.execute(
    "ALTER TABLE lists ADD COLUMN system INTEGER NOT NULL DEFAULT 0"
  )
}
await client.execute(`
  CREATE TABLE IF NOT EXISTS list_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    list_id INTEGER NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
    item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    added_at TEXT NOT NULL,
    UNIQUE(list_id, item_id)
  )
`)
await client.execute(`
  CREATE TABLE IF NOT EXISTS list_placements (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    list_id INTEGER REFERENCES lists(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    source_slug TEXT NOT NULL DEFAULT '',
    type TEXT NOT NULL,
    position INTEGER NOT NULL,
    visible INTEGER NOT NULL DEFAULT 1,
    UNIQUE(list_id, type)
  )
`)
const placementColumns = await client.execute(
  "PRAGMA table_info(list_placements)"
)
const needsCatalogPlacementDefaults = !placementColumns.rows.some(
  (column) => column.name === "source_slug"
)
if (needsCatalogPlacementDefaults) {
  await client.execute(
    "ALTER TABLE list_placements ADD COLUMN source_slug TEXT"
  )
  await client.execute(`
    UPDATE list_placements
    SET source_slug = CASE
      WHEN kind = 'recent' THEN 'recent'
      ELSE coalesce((SELECT slug FROM lists WHERE lists.id = list_placements.list_id), '')
    END
  `)
}
await client.execute(
  "CREATE UNIQUE INDEX IF NOT EXISTS list_placements_type_kind_source_slug_unique ON list_placements(type, kind, source_slug)"
)
await client.execute({
  sql: `
    INSERT INTO lists (slug, name, system, created_at)
    VALUES (?, ?, 1, ?), (?, ?, 1, ?)
    ON CONFLICT(slug) DO UPDATE SET system = 1
  `,
  args: ["watchlist", "Watchlist", now, "reading-list", "Readlist", now],
})
for (const [slug, type] of [
  ["reading-list", "book"],
  ["watchlist", "movie"],
  ["watchlist", "tv"],
] as const) {
  await client.execute({
    sql: `
      INSERT INTO list_placements (list_id, kind, source_slug, type, position, visible)
      SELECT id, 'list', slug, ?, 1, 1 FROM lists WHERE slug = ?
      ON CONFLICT(list_id, type) DO NOTHING
    `,
    args: [type, slug],
  })
}
for (const type of ["book", "movie", "tv"]) {
  await client.execute({
    sql: `
      INSERT INTO list_placements (list_id, kind, source_slug, type, position, visible)
      SELECT NULL, 'recent', 'recent', ?, 0, 1
      WHERE NOT EXISTS (
        SELECT 1 FROM list_placements WHERE kind = 'recent' AND type = ?
      )
    `,
    args: [type, type],
  })
}
if (needsCatalogPlacementDefaults) {
  await client.execute(`
    INSERT INTO list_placements (list_id, kind, source_slug, type, position, visible)
    SELECT NULL, 'genre', slug, type,
      max_position + ROW_NUMBER() OVER (PARTITION BY type ORDER BY name, slug), 1
    FROM (
      SELECT DISTINCT genres.slug, genres.name, items.type,
        COALESCE((
          SELECT MAX(position) FROM list_placements AS placements
          WHERE placements.type = items.type
        ), -1) AS max_position
      FROM item_genres
      INNER JOIN genres ON item_genres.genre_id = genres.id
      INNER JOIN items ON item_genres.item_id = items.id
    )
  `)
}

console.log("Database is ready.")
