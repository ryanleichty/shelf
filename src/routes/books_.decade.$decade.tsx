import { createFileRoute, notFound } from "@tanstack/react-router"
import { YearBrowse } from "@/components/year-browse"
import { getItemsForYearBrowse } from "@/server/items"

export const Route = createFileRoute("/books/decade/$decade")({
  loader: async ({ params }) => {
    const match = params.decade.match(/^(\d{4})s$/)
    if (!match) throw notFound()
    const decade = Number(match[1])
    return getItemsForYearBrowse({
      data: { type: "book", startYear: decade, endYear: decade + 9 },
    })
  },
  component: BookDecadePage,
})

function BookDecadePage() {
  const data = Route.useLoaderData()
  return (
    <YearBrowse
      items={data.items}
      mode="decade"
      type="book"
      value={Number(Route.useParams().decade.slice(0, 4))}
      years={data.years}
    />
  )
}
