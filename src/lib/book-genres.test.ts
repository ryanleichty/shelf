import { describe, expect, test } from "vitest"
import { bookGenreForSubject, bookGenresFromSubjects } from "./book-genres"
import { bookGenreOptions } from "./item-input"

describe("bookGenresFromSubjects", () => {
  test("Theology is a book genre", () => {
    expect(bookGenreOptions).toContain("Theology")
  })
  test("maps Open Library faith subjects onto Theology", () => {
    for (const subject of [
      "Christianity",
      "Theology",
      "Religion",
      "Christian life",
      "Theology, Doctrinal",
      "Christian theology",
      "Bible",
      "God (Christianity)",
    ])
      expect(bookGenreForSubject(subject), subject).toBe("Theology")
  })
  test("normalizes case, spacing and a trailing period", () => {
    expect(bookGenreForSubject("  CHRISTIAN   LIFE. ")).toBe("Theology")
    expect(bookGenreForSubject("science fiction")).toBe("Science Fiction")
  })
  test("returns matched genres once each, in option order", () => {
    expect(
      bookGenresFromSubjects([
        "Christian life",
        "History",
        "Christianity",
        "Fiction",
        "Theology",
      ])
    ).toEqual(["Fiction", "History", "Theology"])
  })
  test("ignores subjects that name no shelf genre", () => {
    expect(
      bookGenresFromSubjects(["Reformed authors", "Large type books"])
    ).toEqual([])
    expect(bookGenresFromSubjects(undefined)).toEqual([])
  })
})
