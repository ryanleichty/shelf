import { describe, expect, test } from "vitest"
import type { Item } from "@/server/schema"
import { changedFields, isBlankSyncValue } from "./sync-fields"

function item(overrides: Partial<Item> = {}): Item {
  return {
    id: 1,
    slug: "true-grit",
    type: "movie",
    status: "owned",
    title: "True Grit",
    creator: "Joel Coen",
    year: 2010,
    coverImageUrl: null,
    backdropImageUrl: null,
    openLibraryKey: null,
    tmdbId: "44264",
    barcode: null,
    format: null,
    edition: null,
    description: null,
    certification: null,
    runtime: null,
    subtitle: null,
    pageCount: null,
    publisher: null,
    isbn13: null,
    tagline: null,
    logoImageUrl: null,
    trailerKey: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    genres: [],
    keywords: [],
    authors: [],
    directors: [],
    actors: [],
    isInSystemList: false,
    ...overrides,
  }
}

describe("isBlankSyncValue", () => {
  test("null, empty strings, provider placeholders, zero and empty lists are blank", () => {
    expect(isBlankSyncValue(null)).toBe(true)
    expect(isBlankSyncValue(undefined)).toBe(true)
    expect(isBlankSyncValue("")).toBe(true)
    expect(isBlankSyncValue("  ")).toBe(true)
    expect(isBlankSyncValue("Untitled")).toBe(true)
    expect(isBlankSyncValue("Unknown author")).toBe(true)
    expect(isBlankSyncValue("Director unavailable")).toBe(true)
    expect(isBlankSyncValue("Creator unavailable")).toBe(true)
    expect(isBlankSyncValue(0)).toBe(true)
    expect(isBlankSyncValue([])).toBe(true)
  })
  test("anything a member set is not", () => {
    expect(isBlankSyncValue("The Justification of God")).toBe(false)
    expect(isBlankSyncValue("John Garth")).toBe(false)
    expect(isBlankSyncValue(1983)).toBe(false)
    expect(isBlankSyncValue(["Theology"])).toBe(false)
    expect(isBlankSyncValue({ name: "Dune Collection" })).toBe(false)
  })
})

describe("changedFields", () => {
  test("never overwrites a title, creator or year that is already set", () => {
    expect(
      changedFields(item(), {
        title: "True grit",
        creator: "Ethan Coen",
        creatorPeople: [{ name: "Ethan Coen", providerId: "1224" }],
        year: 2011,
      })
    ).toEqual({})
  })
  test("fills a blank title, creator or year from the provider", () => {
    expect(
      changedFields(
        item({ title: "Untitled", creator: "Director unavailable", year: 0 }),
        { title: "True Grit", creator: "Joel Coen", year: 2010 }
      )
    ).toEqual({
      title: { before: "Untitled", after: "True Grit" },
      creator: { before: "Director unavailable", after: "Joel Coen" },
      year: { before: 0, after: 2010 },
    })
  })
  test("fills empty book fields but keeps a publisher, ISBN and genres already set", () => {
    const changes = changedFields(
      item({
        type: "book",
        tmdbId: null,
        openLibraryKey: "/works/OL1W",
        title: "Leadership and Emotional Sabotage",
        creator: "Joe Rigney",
        year: 2024,
        publisher: "Canon Press",
        isbn13: "9781591280408",
        genres: ["Nonfiction"],
      }),
      {
        title: "Leadership and emotional sabotage",
        creator: "Joseph Rigney",
        year: 2023,
        genres: ["Theology"],
        publisher: "Canon Press, Inc.",
        isbn13: "9781591280415",
        pageCount: 128,
        subtitle: null,
        description: "A field guide.",
      }
    )
    expect(changes).toEqual({
      pageCount: { before: null, after: 128 },
      description: { before: null, after: "A field guide." },
    })
  })
  test("fills empty genres and cast, and always refreshes keywords and collection", () => {
    const changes = changedFields(
      item({
        keywords: ["old"],
        collection: {
          id: 1,
          slug: "old",
          name: "Old",
          tmdbCollectionId: "1",
          overview: null,
          partIds: null,
        },
      }),
      {
        genres: ["Western"],
        cast: ["Jeff Bridges"],
        keywords: ["remake"],
        collection: { tmdbCollectionId: "2", name: "New" },
      }
    )
    expect(Object.keys(changes).sort()).toEqual([
      "cast",
      "collection",
      "genres",
      "keywords",
    ])
    expect(changes.genres).toEqual({ before: [], after: ["Western"] })
    expect(changes.collection?.after).toEqual({
      tmdbCollectionId: "2",
      name: "New",
    })
  })
  test("reports nothing when both sides are blank", () => {
    expect(
      changedFields(item({ description: null }), {
        description: "",
        runtime: null,
        certification: null,
        genres: [],
      })
    ).toEqual({})
  })
  test("ignores screen-only fields on a book", () => {
    expect(
      changedFields(
        item({ type: "book", tmdbId: null, openLibraryKey: "/works/OL1W" }),
        {
          runtime: 90,
          certification: "PG",
          tagline: "x",
          logoImageUrl: "x",
          trailerKey: "x",
          cast: ["Someone"],
        }
      )
    ).toEqual({})
  })
})
