import {
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

export const lists = sqliteTable("lists", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  createdAt: text("created_at").notNull(),
})

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
export type Item = ItemRecord & {
  genres: string[]
  keywords: string[]
  authors: string[]
  directors: string[]
}
