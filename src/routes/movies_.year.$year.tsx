import { createFileRoute, notFound } from "@tanstack/react-router"
import { YearBrowse } from "@/components/year-browse"
import { getItemsForYearBrowse } from "@/server/items"

export const Route = createFileRoute("/movies/year/$year")({
  loader: async ({ params }) => {
    if (!/^\d{4}$/.test(params.year)) throw notFound()
    const year = Number(params.year)
    return getItemsForYearBrowse({
      data: { type: "movie", startYear: year, endYear: year },
    })
  },
  component: MovieYearPage,
})

function MovieYearPage() {
  const data = Route.useLoaderData()
  return (
    <YearBrowse
      items={data.items}
      mode="year"
      type="movie"
      value={Number(Route.useParams().year)}
      years={data.years}
    />
  )
}
