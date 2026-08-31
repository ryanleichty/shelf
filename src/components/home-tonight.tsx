import { Link } from "@tanstack/react-router"
import type { Item } from "@/server/schema"

type TonightItem = Item & { runtime: number }

export function Tonight({ items }: { items: TonightItem[] }) {
  if (!items.length) return null

  return (
    <section className="overflow-x-hidden">
      <div className="container mx-auto mb-4 max-w-6xl px-4">
        <h2 className="text-xl font-semibold tracking-tight">Tonight</h2>
        <p className="text-sm text-muted-foreground">
          {formatRuntime(
            items.reduce((total, item) => total + item.runtime, 0)
          )}
        </p>
      </div>
      <div className="container mx-auto flex max-w-6xl flex-col gap-3 px-4">
        {items.map((item) => (
          <Link
            className="flex items-center gap-3"
            key={item.id}
            params={{ slug: item.slug }}
            to="/item/$slug"
          >
            <div className="relative aspect-2/3 w-12 shrink-0 overflow-hidden rounded-md bg-muted after:absolute after:inset-0 after:rounded-[inherit] after:border after:border-black/10">
              {item.coverImageUrl && (
                <img
                  alt=""
                  className="h-full w-full object-cover"
                  referrerPolicy="no-referrer"
                  src={item.coverImageUrl}
                />
              )}
            </div>
            <div>
              <p>{item.title}</p>
              <p className="text-sm text-muted-foreground">
                {item.certification?.trim()
                  ? `${item.certification.trim()} · `
                  : ""}
                {formatRuntime(item.runtime)}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}

function formatRuntime(runtime: number) {
  const hours = Math.floor(runtime / 60)
  const minutes = runtime % 60
  return hours ? `${hours}h ${minutes}m` : `${minutes}m`
}
