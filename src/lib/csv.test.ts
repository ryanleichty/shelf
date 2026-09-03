import { describe, expect, test } from "vitest"
import { parseCsv, parseCsvRecords } from "./csv"

describe("parseCsv", () => {
  test("parses plain rows", () => {
    expect(parseCsv("a,b\n1,2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ])
  })

  test("keeps a comma inside a quoted field as one field", () => {
    expect(parseCsv('x,"Dune (Dune, #1)",y')).toEqual([
      ["x", "Dune (Dune, #1)", "y"],
    ])
  })

  test("unescapes a doubled quote inside a quoted field", () => {
    expect(parseCsv('"He said ""no"""')).toEqual([['He said "no"']])
  })

  test("keeps a newline inside a quoted field as one field", () => {
    expect(parseCsv('"line1\nline2",b')).toEqual([["line1\nline2", "b"]])
  })

  test("parses CRLF line endings with no trailing \\r", () => {
    expect(parseCsv("a,b\r\n1,2\r\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ])
  })

  test("strips a leading BOM from the first header", () => {
    expect(parseCsv("﻿a,b\n1,2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ])
  })

  test("does not add an extra row for a trailing newline", () => {
    expect(parseCsv("a,b\n1,2\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ])
  })
})

describe("parseCsvRecords", () => {
  test("keys rows by header name", () => {
    expect(parseCsvRecords("Title,Year\nDune,1965")).toEqual([
      { Title: "Dune", Year: "1965" },
    ])
  })

  test("fills missing trailing columns with an empty string", () => {
    expect(parseCsvRecords("Title,Year,Author\nDune")).toEqual([
      { Title: "Dune", Year: "", Author: "" },
    ])
  })
})
