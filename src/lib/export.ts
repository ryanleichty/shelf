import type { Item } from "@/server/schema"

// Bumped when the payload shape changes incompatibly.
// v2: dropped items.borrower/loanedAt (now lending history) in favor of a
// top-level `loans` section.
export const EXPORT_VERSION = 2

export function buildExport(input: {
  items: Item[]
  lists: Array<{ id: number; slug: string; name: string; system: boolean }>
  listItems: Array<{ listSlug: string; itemSlug: string; position: number }>
  loans: Array<{
    itemSlug: string
    borrowerName: string
    lentAt: string
    dueAt: string | null
    returnedAt: string | null
  }>
  exportedAt: string
}) {
  return {
    version: EXPORT_VERSION,
    exportedAt: input.exportedAt,
    items: input.items.map((item) => ({
      slug: item.slug,
      type: item.type,
      status: item.status,
      title: item.title,
      creator: item.creator,
      year: item.year,
      format: item.format,
      edition: item.edition,
      barcode: item.barcode,
      coverImageUrl: item.coverImageUrl,
      backdropImageUrl: item.backdropImageUrl,
      logoImageUrl: item.logoImageUrl,
      description: item.description,
      tagline: item.tagline,
      trailerKey: item.trailerKey,
      certification: item.certification,
      runtime: item.runtime,
      subtitle: item.subtitle,
      pageCount: item.pageCount,
      publisher: item.publisher,
      isbn13: item.isbn13,
      openLibraryKey: item.openLibraryKey,
      tmdbId: item.tmdbId,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      genres: item.genres,
      keywords: item.keywords,
      authors: item.authors,
      directors: item.directors,
      actors: item.actors,
      collection: item.collection
        ? {
            slug: item.collection.slug,
            name: item.collection.name,
            overview: item.collection.overview,
          }
        : null,
    })),
    lists: input.lists.map((list) => ({
      slug: list.slug,
      name: list.name,
      system: list.system,
    })),
    listItems: input.listItems.map((listItem) => ({
      listSlug: listItem.listSlug,
      itemSlug: listItem.itemSlug,
      position: listItem.position,
    })),
    loans: input.loans.map((loan) => ({
      itemSlug: loan.itemSlug,
      borrowerName: loan.borrowerName,
      lentAt: loan.lentAt,
      dueAt: loan.dueAt,
      returnedAt: loan.returnedAt,
    })),
  }
}
