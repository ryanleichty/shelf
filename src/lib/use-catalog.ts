import { useMemo } from "react"
import { useLoaderData } from "@tanstack/react-router"

export function useCatalog() {
  return useLoaderData({ from: "__root__", select: (data) => data.catalog })
}

export function useCatalogItems(itemIds: number[]) {
  const catalog = useCatalog()
  return useMemo(() => {
    const byId = new Map(catalog.items.map((item) => [item.id, item]))
    return itemIds.flatMap((id) => {
      const item = byId.get(id)
      return item ? [item] : []
    })
  }, [catalog, itemIds])
}
