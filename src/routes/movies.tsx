import { createFileRoute } from "@tanstack/react-router"
import { useMemo } from "react"
import { TypeHome } from "@/components/type-home"
import { homeRows } from "@/lib/catalog"
import { useCatalog } from "@/lib/use-catalog"

export const Route = createFileRoute("/movies")({ component: Movies })

function Movies() {
  const catalog = useCatalog()
  const rows = useMemo(() => homeRows(catalog, "movie"), [catalog])
  return (
    <TypeHome
      addLabel="Add movie"
      rows={rows}
      subtitle="The film shelf"
      title="Movies"
      type="movie"
    />
  )
}
