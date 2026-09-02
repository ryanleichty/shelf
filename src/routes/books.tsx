import { createFileRoute } from "@tanstack/react-router"
import { useMemo } from "react"
import { TypeHome } from "@/components/type-home"
import { homeRows } from "@/lib/catalog"
import { useCatalog } from "@/lib/use-catalog"

export const Route = createFileRoute("/books")({ component: Books })

function Books() {
  const catalog = useCatalog()
  const rows = useMemo(() => homeRows(catalog, "book"), [catalog])
  return (
    <TypeHome
      addLabel="Add book"
      rows={rows}
      subtitle="The book shelf"
      title="Books"
      type="book"
    />
  )
}
