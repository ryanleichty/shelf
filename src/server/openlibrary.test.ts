import { afterEach, describe, expect, test, vi } from "vitest"
import { getBookResultById } from "./openlibrary"

function stubFetch(routes: Record<string, unknown>) {
  vi.stubGlobal("fetch", (input: URL | string) => {
    const url = String(input)
    const match = Object.keys(routes).find((key) => url.includes(key))
    return Promise.resolve({
      ok: match !== undefined,
      status: match === undefined ? 404 : 200,
      json: () => Promise.resolve(match ? routes[match] : {}),
    } as Response)
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("getBookResultById", () => {
  test("falls back to the search index when the work has no publish date", async () => {
    stubFetch({
      "/works/OL1W.json": { title: "Fantastic Mr Fox" },
      "search.json": { docs: [{ first_publish_year: 1970 }] },
    })
    expect((await getBookResultById("/works/OL1W")).year).toBe(1970)
  })
  test("prefers the work's own publish date", async () => {
    stubFetch({
      "/works/OL1W.json": {
        title: "Fantastic Mr Fox",
        first_publish_date: "1970",
      },
      "search.json": { docs: [{ first_publish_year: 1917 }] },
    })
    expect((await getBookResultById("/works/OL1W")).year).toBe(1970)
  })
})
