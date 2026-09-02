import { describe, expect, test } from "vitest"
import { isDisallowedHost } from "./remote-image"

describe("isDisallowedHost", () => {
  test("blocks loopback, private and link-local addresses", () => {
    for (const host of [
      "localhost",
      "127.0.0.1",
      "10.1.2.3",
      "172.16.0.1",
      "172.31.255.255",
      "192.168.1.1",
      "169.254.169.254",
      "0.0.0.0",
      "::1",
      "fd00::1",
      "fe80::1",
      "[::1]",
      "db.internal",
      "printer.local",
    ])
      expect(isDisallowedHost(host), host).toBe(true)
  })
  test("allows public hosts", () => {
    for (const host of [
      "image.tmdb.org",
      "covers.openlibrary.org",
      "8.8.8.8",
      "172.32.0.1",
      "2606:4700::1111",
    ])
      expect(isDisallowedHost(host), host).toBe(false)
  })
})
