import { describe, expect, test } from "vitest"
import {
  DUMMY_PASSWORD_HASH,
  hashPassword,
  isAgentToken,
  passwordsMatch,
  verifyStoredPassword,
} from "./auth"

describe("passwords", () => {
  test("round-trips and rejects wrong or malformed input", async () => {
    const hash = await hashPassword("correct horse")
    expect(await verifyStoredPassword("correct horse", hash)).toBe(true)
    expect(await verifyStoredPassword("wrong", hash)).toBe(false)
    expect(await verifyStoredPassword("anything", "no-colon")).toBe(false)
    expect(await verifyStoredPassword("anything", DUMMY_PASSWORD_HASH)).toBe(
      false
    )
  })

  test("passwordsMatch is length-safe", () => {
    expect(passwordsMatch("abc", "abc")).toBe(true)
    expect(passwordsMatch("abc", "abd")).toBe(false)
    expect(passwordsMatch("abc", "abcd")).toBe(false)
  })
})

describe("isAgentToken", () => {
  test("accepts raw and Bearer-prefixed tokens, rejects the rest", () => {
    process.env.SHELF_AGENT_TOKEN = "secret-token"
    expect(isAgentToken("secret-token")).toBe(true)
    expect(isAgentToken("Bearer secret-token")).toBe(true)
    expect(isAgentToken("bearer secret-token")).toBe(true)
    expect(isAgentToken("secret-tokenX")).toBe(false)
    expect(isAgentToken("")).toBe(false)
    delete process.env.SHELF_AGENT_TOKEN
    expect(isAgentToken("secret-token")).toBe(false)
  })
})
