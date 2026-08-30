import { createFileRoute } from "@tanstack/react-router"
import { TypeHome } from "@/components/type-home"
import { getHomeRows } from "@/server/items"

export const Route = createFileRoute("/movies")({
  loader: () => getHomeRows({ data: { type: "movie" } }),
  component: Movies,
})

function Movies() {
  return (
    <TypeHome
      addLabel="Add movie"
      rows={Route.useLoaderData()}
      subtitle="The film shelf"
      title="Movies"
      type="movie"
    />
  )
}
