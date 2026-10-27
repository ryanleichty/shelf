import { z } from "zod"
import { itemEditions, itemFormats } from "@/lib/catalog"

// Edition details Open Library sources for books; a movie or TV row never
// carries them, so the PATCH handler rejects them for anything but a book.
export const bookEditionFields = [
  "subtitle",
  "pageCount",
  "publisher",
  "isbn13",
] as const

// Strict on purpose: a key the schema does not know is a 400, never a
// silent drop that reports success for a field that was never written.
export const itemPatchInput = z.strictObject({
  title: z.string().min(1).max(240).optional(),
  creator: z.string().min(1).max(240).optional(),
  year: z.number().int().min(0).max(3000).optional(),
  format: z.enum(itemFormats).nullable().optional(),
  edition: z.enum(itemEditions).nullable().optional(),
  status: z.enum(["owned", "borrowed"]).optional(),
  coverImageUrl: z.string().url().max(2000).nullable().optional(),
  slug: z.string().min(1).max(120).optional(),
  subtitle: z.string().trim().min(1).max(500).nullable().optional(),
  pageCount: z.number().int().positive().max(100_000).nullable().optional(),
  publisher: z.string().trim().min(1).max(240).nullable().optional(),
  isbn13: z
    .string()
    .transform((value) => value.replace(/[\s-]/g, ""))
    .pipe(z.string().regex(/^\d{13}$/, "ISBN-13 must be 13 digits"))
    .nullable()
    .optional(),
})

export type ItemPatchInput = z.infer<typeof itemPatchInput>

export function hasBookEditionFields(data: ItemPatchInput) {
  return bookEditionFields.some((field) => data[field] !== undefined)
}
