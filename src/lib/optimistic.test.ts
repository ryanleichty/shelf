import { describe, expect, test } from "vitest"
import { acceptServerValue } from "./optimistic"

describe("acceptServerValue", () => {
  test("accepts everything once the override is cleared", () => {
    expect(acceptServerValue(null, true)).toBe(true)
    expect(acceptServerValue(null, false)).toBe(true)
  })
  test("rejects disagreeing server state while an override is live", () => {
    expect(acceptServerValue(true, false)).toBe(false)
    expect(acceptServerValue(false, true)).toBe(false)
  })
  test("accepts agreeing server state while an override is live", () => {
    expect(acceptServerValue(true, true)).toBe(true)
  })
})
