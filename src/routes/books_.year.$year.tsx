import { createFileRoute, notFound } from "@tanstack/react-router"
import { useMemo } from "react"
import { YearBrowse } from "@/components/year-browse"
import { yearBrowse } from "@/lib/catalog"
import { useCatalog } from "@/lib/use-catalog"

export const Route = createFileRoute("/books_/year/$year")({
  loader: ({ params }) => {
    if (!/^\d{4}$/.test(params.year)) throw notFound()
  },
  component: BookYearPage,
})

function BookYearPage() {
  const year = Number(Route.useParams().year)
  const catalog = useCatalog()
  const data = useMemo(
    () => yearBrowse(catalog, "book", year, year),
    [catalog, year]
  )
  return (
    <YearBrowse
      items={data.items}
      mode="year"
      type="book"
      value={year}
      years={data.years}
    />
  )
}
