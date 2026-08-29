import { createFileRoute, notFound } from "@tanstack/react-router"
import { YearBrowse } from "@/components/year-browse"
import { getItemsForYearBrowse } from "@/server/items"

export const Route = createFileRoute("/movies/decade/$decade")({
  loader: async ({ params }) => {
    const match = params.decade.match(/^(\d{4})s$/)
    if (!match) throw notFound()
    const decade = Number(match[1])
    return getItemsForYearBrowse({
      data: { type: "movie", startYear: decade, endYear: decade + 9 },
    })
  },
  component: MovieDecadePage,
})

function MovieDecadePage() {
  const data = Route.useLoaderData()
  return (
    <YearBrowse
      items={data.items}
      mode="decade"
      type="movie"
      value={Number(Route.useParams().decade.slice(0, 4))}
      years={data.years}
    />
  )
}
