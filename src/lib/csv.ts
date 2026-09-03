// Minimal RFC 4180 reader: quoted fields, "" escapes, CRLF or LF rows.
// Enough for Goodreads and Letterboxd exports; not a general CSV library.
export function parseCsv(input: string): string[][] {
  const text = input.startsWith("﻿") ? input.slice(1) : input
  const rows: string[][] = []
  let row: string[] = []
  let field = ""
  let inQuotes = false
  let rowStarted = false

  const endField = () => {
    row.push(field)
    field = ""
  }
  const endRow = () => {
    endField()
    rows.push(row)
    row = []
    rowStarted = false
  }

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    rowStarted = true
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += char
      }
      continue
    }
    if (char === '"') {
      inQuotes = true
    } else if (char === ",") {
      endField()
    } else if (char === "\r" && text[i + 1] === "\n") {
      endRow()
      i++
    } else if (char === "\n" || char === "\r") {
      endRow()
    } else {
      field += char
    }
  }
  if (rowStarted) endRow()

  return rows
}

// Reads the first row as headers (trimmed) and zips each later row against
// them by name, ignoring rows that are entirely empty.
export function parseCsvRecords(input: string): Array<Record<string, string>> {
  const rows = parseCsv(input)
  if (rows.length === 0) return []
  const headers = rows[0].map((h) => h.trim())
  return rows
    .slice(1)
    .filter((row) => !(row.length === 1 && row[0] === ""))
    .map((row) => {
      const record: Record<string, string> = {}
      headers.forEach((header, index) => {
        record[header] = row[index] ?? ""
      })
      return record
    })
}
