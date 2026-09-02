import { z } from "zod"
import { itemEditions, itemStatuses, itemTypes } from "@/lib/catalog"

export const bookGenreOptions = [
  "Fiction",
  "Nonfiction",
  "Science Fiction",
  "Fantasy",
  "Mystery",
  "Romance",
  "History",
  "Biography",
  "Young Adult",
  "Poetry",
  "Comics",
] as const
export const screenGenreOptions = [
  "Action",
  "Adventure",
  "Animation",
  "Comedy",
  "Crime",
  "Documentary",
  "Drama",
  "Family",
  "Fantasy",
  "History",
  "Horror",
  "Mystery",
  "Romance",
  "Science Fiction",
  "Thriller",
  "War",
  "Western",
] as const

export const itemInput = z
  .object({
    id: z.number().int().optional(),
    slug: z.string().min(1).max(120),
    type: z.enum(itemTypes),
    status: z.enum(itemStatuses).default("owned"),
    title: z.string().min(1).max(240),
    creator: z.string().max(240).optional().default(""),
    authors: z.array(z.string().trim().min(1).max(240)).max(20).default([]),
    directors: z.array(z.string().trim().min(1).max(240)).max(20).default([]),
    actors: z.array(z.string().trim().min(1).max(240)).max(100).default([]),
    year: z.number().int().min(0).max(3000),
    coverImageUrl: z.string().url().optional().or(z.literal("")),
    openLibraryKey: z.string().max(120).optional().or(z.literal("")),
    tmdbId: z.string().max(40).optional().or(z.literal("")),
    barcode: z.string().max(80).optional().or(z.literal("")),
    borrower: z.string().max(120).optional().or(z.literal("")),
    loanedAt: z.string().date().optional().or(z.literal("")),
    format: z
      .enum(["hardcover", "paperback", "blu-ray", "dvd", "other"])
      .optional()
      .or(z.literal("")),
    edition: z.enum(itemEditions).optional().or(z.literal("")),
    genres: z.array(z.string().max(60)).max(20).default([]),
    description: z.string().max(10000).optional().or(z.literal("")),
  })
  .superRefine((item, context) => {
    const primaryPeople = item.type === "book" ? item.authors : item.directors
    if (!primaryPeople.length && !item.creator.trim()) {
      context.addIssue({
        code: "custom",
        message: `Add at least one ${item.type === "book" ? "author" : "director"}.`,
        path: [item.type === "book" ? "authors" : "directors"],
      })
    }
    if (item.type !== "book" && item.status === "reading") {
      context.addIssue({
        code: "custom",
        message: "Only books can have Reading status.",
        path: ["status"],
      })
    }
    if (item.status === "borrowed" && !item.borrower?.trim()) {
      context.addIssue({
        code: "custom",
        message: "Borrowed items need a borrower.",
        path: ["borrower"],
      })
    }
    if (item.status !== "borrowed" && (item.borrower || item.loanedAt)) {
      context.addIssue({
        code: "custom",
        message: "Loan details only apply to borrowed items.",
        path: ["status"],
      })
    }
    if (
      item.type === "book" &&
      ["blu-ray", "dvd"].includes(item.format ?? "")
    ) {
      context.addIssue({
        code: "custom",
        message: "Choose a book format.",
        path: ["format"],
      })
    }
    if (
      (item.type === "movie" || item.type === "tv") &&
      ["hardcover", "paperback"].includes(item.format ?? "")
    ) {
      context.addIssue({
        code: "custom",
        message: "Choose a movie format.",
        path: ["format"],
      })
    }
    if (item.type === "book" && item.edition) {
      context.addIssue({
        code: "custom",
        message: "Only movies and TV shows can have an edition.",
        path: ["edition"],
      })
    }
  })

export type ItemInput = z.infer<typeof itemInput>
