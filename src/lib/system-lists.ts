export const READLIST_SLUG = "reading-list"
export const READLIST_NAME = "Readlist"

export function displayListName(slug: string | null, name: string | null) {
  return slug === READLIST_SLUG ? READLIST_NAME : name
}
