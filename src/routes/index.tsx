import { Link, createFileRoute } from "@tanstack/react-router"
import { useMemo } from "react"
import { HomeBillboard, type Billboard } from "@/components/home-billboard"
import { HomeCarousel } from "@/components/home-carousel"
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { itemsOfType, recentItems } from "@/lib/catalog"
import { useCatalog } from "@/lib/use-catalog"

export const Route = createFileRoute("/")({ component: Home })

function Home() {
  const catalog = useCatalog()
  const { billboards, rows } = useMemo(() => {
    const featured = recentItems(
      catalog.items.filter(
        (item): item is Billboard =>
          item.status === "owned" &&
          (item.type === "movie" || item.type === "tv") &&
          Boolean(item.backdropImageUrl) &&
          Boolean(item.tmdbId)
      ),
      5
    )
    const shelves = [
      { title: "Books", to: "/books" as const, type: "book" as const },
      { title: "Movies", to: "/movies" as const, type: "movie" as const },
      { title: "TV", to: "/tv" as const, type: "tv" as const },
    ]
      .map((row) => ({
        ...row,
        items: recentItems(itemsOfType(catalog, row.type), 12),
      }))
      .filter((row) => row.items.length)
    return { billboards: featured, rows: shelves }
  }, [catalog])

  return (
    <main className="overflow-x-hidden">
      <HomeBillboard billboards={billboards} />
      {rows.length ? (
        <div className="mt-10 flex flex-col gap-10 pb-10">
          {rows.map((row, index) => (
            <section className="overflow-x-hidden" key={row.title}>
              <div className="container mx-auto mb-4 max-w-6xl px-4">
                <h2 className="text-xl font-semibold tracking-tight">
                  <Link className="hover:underline" to={row.to}>
                    {row.title}
                  </Link>
                </h2>
              </div>
              <HomeCarousel id={`home-row-${index}`} items={row.items} />
            </section>
          ))}
        </div>
      ) : (
        <div className="container mx-auto max-w-6xl px-4">
          <Empty className="border p-12">
            <EmptyHeader>
              <EmptyTitle>The shelf is empty.</EmptyTitle>
            </EmptyHeader>
          </Empty>
        </div>
      )}
    </main>
  )
}
