import { createFileRoute } from "@tanstack/react-router"
import { useMemo } from "react"
import { TypeHome } from "@/components/type-home"
import { homeRows } from "@/lib/catalog"
import { useCatalog } from "@/lib/use-catalog"

export const Route = createFileRoute("/tv")({ component: TV })

function TV() {
  const catalog = useCatalog()
  const rows = useMemo(() => homeRows(catalog, "tv"), [catalog])
  return (
    <TypeHome
      addLabel="Add show"
      rows={rows}
      subtitle="The television shelf"
      title="TV"
      type="tv"
    />
  )
}
