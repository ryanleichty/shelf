import { createFileRoute, Link } from "@tanstack/react-router"
import { PlusIcon } from "lucide-react"
import { HomeCarousel } from "@/components/home-carousel"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import { itemTypes, typeLabels, typeSegments } from "@/lib/catalog"
import { useCatalog } from "@/lib/use-catalog"

export const Route = createFileRoute("/wishlist")({ component: Wishlist })

function Wishlist() {
  const { wishlist } = useCatalog()
  const rows = itemTypes
    .map((type) => ({
      type,
      items: wishlist.filter((item) => item.type === type),
    }))
    .filter((row) => row.items.length)
  return (
    <main className="overflow-x-clip py-10">
      <section className="container mx-auto mb-10 flex max-w-6xl items-end justify-between gap-4 px-4">
        <div>
          <p className="text-sm text-muted-foreground">Wishlist</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Things I don't own yet
          </h1>
        </div>
        <Button render={<Link search={{ wanted: true }} to="/admin/new" />}>
          <PlusIcon />
          Add to wishlist
        </Button>
      </section>
      {rows.length ? (
        <div className="flex flex-col gap-10">
          {rows.map((row) => (
            <section className="overflow-x-clip" key={row.type}>
              <div className="container mx-auto mb-4 max-w-6xl px-4">
                <h2 className="text-xl font-semibold tracking-tight">
                  <Link
                    className="hover:underline"
                    params={{ section: typeSegments[row.type] }}
                    to="/wishlist/$section"
                  >
                    {typeLabels[row.type]}
                  </Link>
                </h2>
              </div>
              <HomeCarousel id={`wishlist-${row.type}`} items={row.items} />
            </section>
          ))}
        </div>
      ) : (
        <div className="container mx-auto max-w-6xl px-4">
          <Empty className="border p-12">
            <EmptyHeader>
              <EmptyTitle>The wishlist is empty.</EmptyTitle>
              <EmptyDescription>
                Add a book, movie, or show you don't own yet.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </div>
      )}
    </main>
  )
}
