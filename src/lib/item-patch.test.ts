import { describe, expect, test } from "vitest"
import { hasBookEditionFields, itemPatchInput } from "./item-patch"

describe("itemPatchInput", () => {
  test("keeps publisher and ISBN instead of stripping them", () => {
    const parsed = itemPatchInput.parse({
      publisher: "Canon Press",
      isbn13: "978-1-59128-040-8",
      pageCount: 128,
      subtitle:
        "Resisting the Anxiety That Will Wreck Your Family, Destroy Your Church, and Ruin the World",
    })
    expect(parsed.publisher).toBe("Canon Press")
    expect(parsed.isbn13).toBe("9781591280408")
    expect(parsed.pageCount).toBe(128)
    expect(hasBookEditionFields(parsed)).toBe(true)
  })
  test("accepts null to clear an edition field", () => {
    const parsed = itemPatchInput.parse({ publisher: null, isbn13: null })
    expect(parsed).toEqual({ publisher: null, isbn13: null })
  })
  test("rejects an ISBN that is not 13 digits", () => {
    expect(itemPatchInput.safeParse({ isbn13: "1591280400" }).success).toBe(
      false
    )
    expect(itemPatchInput.safeParse({ isbn13: "" }).success).toBe(false)
  })
  test("rejects unknown keys rather than dropping them", () => {
    const result = itemPatchInput.safeParse({
      title: "Leadership and Emotional Sabotage",
      isbn: "9781591280408",
    })
    expect(result.success).toBe(false)
    expect(
      result.error?.issues.map((issue) => issue.message).join(" ")
    ).toMatch(/isbn/)
  })
  test("still rejects statuses that are not owned or borrowed", () => {
    expect(itemPatchInput.safeParse({ status: "wanted" }).success).toBe(false)
    expect(itemPatchInput.safeParse({ status: "reading" }).success).toBe(false)
    expect(itemPatchInput.safeParse({ status: "owned" }).success).toBe(true)
  })
  test("a body with no edition fields does not trigger the book-only guard", () => {
    expect(hasBookEditionFields(itemPatchInput.parse({ year: 2010 }))).toBe(
      false
    )
  })
})
