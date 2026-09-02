import { describe, expect, test } from "vitest"
import {
  homeRows,
  listPage,
  matchesQuery,
  statusLabel,
  yearBrowse,
  type Catalog,
  type CatalogItem,
} from "./catalog"

const item = (
  id: number,
  overrides: Partial<CatalogItem> = {}
): CatalogItem => ({
  id,
  slug: `item-${id}`,
  type: "movie",
  status: "owned",
  title: `Title ${id}`,
  creator: "Someone",
  year: 1990 + id,
  coverImageUrl: `https://img/${id}.jpg`,
  backdropImageUrl: null,
  tmdbId: null,
  format: null,
  edition: null,
  certification: null,
  runtime: null,
  pageCount: null,
  borrower: null,
  tagline: null,
  logoImageUrl: null,
  trailerKey: null,
  createdAt: `2026-01-0${id}`,
  updatedAt: `2026-01-0${id}`,
  genres: ["Action"],
  authors: [],
  directors: ["Steven Spielberg"],
  collectionId: null,
  isInSystemList: false,
  ...overrides,
})

const catalog: Catalog = {
  items: [
    item(1),
    item(2, { genres: ["Drama"] }),
    item(3, { type: "book", directors: [], authors: ["John Piper"] }),
  ],
  lists: [{ id: 10, slug: "watchlist", name: "Watchlist", system: true }],
  memberships: [
    { listId: 10, itemId: 2, position: 1 },
    { listId: 10, itemId: 1, position: 2 },
  ],
  placements: [
    {
      id: 1,
      listId: 10,
      kind: "list",
      sourceSlug: "watchlist",
      type: "movie",
      position: 0,
      visible: true,
      slug: "watchlist",
      name: "Watchlist",
    },
    {
      id: 2,
      listId: null,
      kind: "recent",
      sourceSlug: "recent",
      type: "movie",
      position: 1,
      visible: true,
      slug: null,
      name: null,
    },
    {
      id: 3,
      listId: null,
      kind: "genre",
      sourceSlug: "action",
      type: "movie",
      position: 2,
      visible: true,
      slug: null,
      name: "Action",
    },
    {
      id: 4,
      listId: null,
      kind: "director",
      sourceSlug: "steven-spielberg",
      type: "movie",
      position: 3,
      visible: false,
      slug: null,
      name: "Steven Spielberg",
    },
  ],
  collections: [],
  actorItems: {},
}

describe("catalog derivations", () => {
  test("homeRows follows placement order, membership order, and visibility", () => {
    const rows = homeRows(catalog, "movie")
    expect(rows.map((row) => row.title)).toEqual([
      "Watchlist",
      "Recently added",
      "Action",
    ])
    expect(rows[0].items.map((entry) => entry.id)).toEqual([2, 1])
    expect(rows[1].items.map((entry) => entry.id)).toEqual([2, 1])
    expect(rows[2].items.map((entry) => entry.id)).toEqual([1])
  })

  test("listPage scopes a list to one type", () => {
    expect(listPage(catalog, "movie", "watchlist")?.totalCount).toBe(2)
    expect(listPage(catalog, "book", "watchlist")).toBeNull()
  })

  test("yearBrowse returns the type's years and the range", () => {
    expect(yearBrowse(catalog, "movie", 1991, 1991).items).toHaveLength(1)
    expect(yearBrowse(catalog, "movie", 0, 9999).years).toEqual([1991, 1992])
  })

  test("matchesQuery searches title, creator, genres, and people", () => {
    expect(matchesQuery(catalog.items[2], "piper")).toBe(true)
    expect(matchesQuery(catalog.items[0], "spielberg action")).toBe(true)
    expect(matchesQuery(catalog.items[1], "action")).toBe(false)
  })
})

describe("statusLabel", () => {
  test("names every non-owned status", () => {
    expect(statusLabel("reading")).toBe("Reading")
    expect(statusLabel("watching")).toBe("Watching")
    expect(statusLabel("borrowed")).toBe("Borrowed")
  })
})
