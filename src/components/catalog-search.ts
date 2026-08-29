import type { Item } from "@/server/schema"

const catalogQueryStorageKey = "shelf:catalog-query"

export function rememberCatalogQuery(type: Item["type"], query?: string) {
  if (typeof window === "undefined") return

  window.sessionStorage.setItem(
    `${catalogQueryStorageKey}:${type}`,
    query ?? ""
  )
}

export function getLastCatalogQuery(type: Item["type"]) {
  if (typeof window === "undefined") return undefined

  return (
    window.sessionStorage.getItem(`${catalogQueryStorageKey}:${type}`) ||
    undefined
  )
}
