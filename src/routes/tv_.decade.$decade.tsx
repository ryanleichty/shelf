import { createFileRoute, notFound } from "@tanstack/react-router"
import { useMemo } from "react"
import { YearBrowse } from "@/components/year-browse"
import { yearBrowse } from "@/lib/catalog"
import { useCatalog } from "@/lib/use-catalog"

export const Route = createFileRoute("/tv_/decade/$decade")({
  loader: ({ params }) => {
    if (!/^\d{4}s$/.test(params.decade)) throw notFound()
  },
  component: TvDecadePage,
})

function TvDecadePage() {
  const decade = Number(Route.useParams().decade.slice(0, 4))
  const catalog = useCatalog()
  const data = useMemo(
    () => yearBrowse(catalog, "tv", decade, decade + 9),
    [catalog, decade]
  )
  return (
    <YearBrowse
      items={data.items}
      mode="decade"
      type="tv"
      value={decade}
      years={data.years}
    />
  )
}
