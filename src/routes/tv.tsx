import { createFileRoute } from "@tanstack/react-router"
import { TypeHome } from "@/components/type-home"
import { getHomeRows } from "@/server/items"

export const Route = createFileRoute("/tv")({
  loader: () => getHomeRows({ data: { type: "tv" } }),
  component: TV,
})

function TV() {
  return (
    <TypeHome
      addLabel="Add TV"
      rows={Route.useLoaderData()}
      subtitle="The television shelf"
      title="TV"
      type="tv"
    />
  )
}
