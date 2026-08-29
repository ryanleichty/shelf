import { Link, createFileRoute } from "@tanstack/react-router"
import { HomeCarousel } from "@/components/home-carousel"
import { getHomeRows } from "@/server/items"

export const Route = createFileRoute("/")({
  loader: () => getHomeRows(),
  component: Home,
})

function Home() {
  const rows = Route.useLoaderData()
  return (
    <main className="py-10">
      <div className="container mx-auto mb-10 max-w-6xl px-4">
        <p className="text-sm text-muted-foreground">Ryan Leichty&apos;s collection</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Shelf</h1>
      </div>
      {rows.length ? (
        <div className="space-y-10">
          {rows.map((row, index) => (
            <section key={row.title}>
              <div className="container mx-auto mb-4 max-w-6xl px-4">
                <h2 className="text-xl font-semibold tracking-tight">
                  {row.slug ? (
                    <Link
                      className="hover:underline"
                      params={{ slug: row.slug }}
                      to="/genre/$slug"
                    >
                      {row.title}
                    </Link>
                  ) : (
                    row.title
                  )}
                </h2>
              </div>
              <div className="pl-4">
                <HomeCarousel
                  id={`home-row-${index}`}
                  items={row.items}
                />
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="container mx-auto max-w-6xl px-4">
          <div className="rounded-lg border border-dashed p-12 text-center">
            <p className="font-medium">The shelf is empty.</p>
          </div>
        </div>
      )}
    </main>
  )
}
