import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core"

export const itemTypes = ["book", "movie", "tv"] as const
export type ItemType = (typeof itemTypes)[number]
export const itemStatuses = [
  "owned",
  "borrowed",
  "reading",
  "watching",
] as const
export type ItemStatus = (typeof itemStatuses)[number]
export const itemEditions = ["theatrical", "extended", "director-cut"] as const
export type ItemEdition = (typeof itemEditions)[number]
export const userRoles = ["admin", "member"] as const
export type UserRole = (typeof userRoles)[number]

export const users = sqliteTable(
  "users",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    email: text("email").notNull(),
    role: text("role", { enum: userRoles }).notNull().default("member"),
    passwordHash: text("password_hash").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [uniqueIndex("users_email_unique").on(table.email)]
)

export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: text("expires_at").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("sessions_user_id_idx").on(table.userId)]
)

export const items = sqliteTable("items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  type: text("type", { enum: itemTypes }).notNull(),
  status: text("status", { enum: itemStatuses }).notNull().default("owned"),
  title: text("title").notNull(),
  creator: text("creator").notNull(),
  year: integer("year").notNull(),
  coverImageUrl: text("cover_image_url"),
  openLibraryKey: text("open_library_key"),
  tmdbId: text("tmdb_id"),
  barcode: text("barcode").unique(),
  borrower: text("borrower"),
  loanedAt: text("loaned_at"),
  format: text("format"),
  edition: text("edition"),
  description: text("description"),
  notes: text("notes").notNull().default(""),
  acquiredAt: text("acquired_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
})

export const genres = sqliteTable("genres", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
})

export const itemGenres = sqliteTable(
  "item_genres",
  {
    itemId: integer("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    genreId: integer("genre_id")
      .notNull()
      .references(() => genres.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("item_genres_item_id_genre_id_unique").on(
      table.itemId,
      table.genreId
    ),
  ]
)

export const keywords = sqliteTable("keywords", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
})

export const itemKeywords = sqliteTable(
  "item_keywords",
  {
    itemId: integer("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    keywordId: integer("keyword_id")
      .notNull()
      .references(() => keywords.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("item_keywords_item_id_keyword_id_unique").on(
      table.itemId,
      table.keywordId
    ),
  ]
)

export const authors = sqliteTable("authors", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
})

export const itemAuthors = sqliteTable(
  "item_authors",
  {
    itemId: integer("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    authorId: integer("author_id")
      .notNull()
      .references(() => authors.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("item_authors_item_id_author_id_unique").on(
      table.itemId,
      table.authorId
    ),
  ]
)

export const directors = sqliteTable("directors", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
})

export const itemDirectors = sqliteTable(
  "item_directors",
  {
    itemId: integer("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    directorId: integer("director_id")
      .notNull()
      .references(() => directors.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("item_directors_item_id_director_id_unique").on(
      table.itemId,
      table.directorId
    ),
  ]
)

export const actors = sqliteTable("actors", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
})

export const itemActors = sqliteTable(
  "item_actors",
  {
    itemId: integer("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    actorId: integer("actor_id")
      .notNull()
      .references(() => actors.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
  },
  (table) => [
    uniqueIndex("item_actors_item_id_actor_id_unique").on(
      table.itemId,
      table.actorId
    ),
  ]
)

export const collections = sqliteTable("collections", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  tmdbCollectionId: text("tmdb_collection_id").unique(),
  overview: text("overview"),
})

export const itemCollections = sqliteTable(
  "item_collections",
  {
    itemId: integer("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    collectionId: integer("collection_id")
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("item_collections_item_id_unique").on(table.itemId),
    uniqueIndex("item_collections_item_id_collection_id_unique").on(
      table.itemId,
      table.collectionId
    ),
  ]
)

export const lists = sqliteTable("lists", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  system: integer("system", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull(),
})

export const listPlacements = sqliteTable(
  "list_placements",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    listId: integer("list_id").references(() => lists.id, {
      onDelete: "cascade",
    }),
    kind: text("kind", { enum: ["recent", "list"] }).notNull(),
    type: text("type", { enum: itemTypes }).notNull(),
    position: integer("position").notNull(),
    visible: integer("visible", { mode: "boolean" }).notNull().default(true),
  },
  (table) => [
    uniqueIndex("list_placements_list_id_type_unique").on(
      table.listId,
      table.type
    ),
  ]
)

export const listItems = sqliteTable(
  "list_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    listId: integer("list_id")
      .notNull()
      .references(() => lists.id, { onDelete: "cascade" }),
    itemId: integer("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    addedAt: text("added_at").notNull(),
  },
  (table) => [
    uniqueIndex("list_items_list_id_item_id_unique").on(
      table.listId,
      table.itemId
    ),
  ]
)

export type ItemRecord = typeof items.$inferSelect
export type Collection = typeof collections.$inferSelect
export type Item = ItemRecord & {
  genres: string[]
  keywords: string[]
  authors: string[]
  directors: string[]
  actors: string[]
  collection?: Collection
}
