import { Link } from "@tanstack/react-router"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { CatalogItem } from "@/lib/catalog"

export function OutNow({
  items,
  fromAll = false,
}: {
  items: CatalogItem[]
  fromAll?: boolean
}) {
  const out = items.filter((item) => item.status !== "owned")
  if (!out.length) return null
  return (
    <section className="mb-8" aria-labelledby="out-now-heading">
      <Card>
        <CardHeader className="pb-2">
          <p className="text-sm text-muted-foreground">In motion</p>
          <CardTitle id="out-now-heading">Currently out</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2">
          {out.map((item) => (
            <Link
              key={item.id}
              params={{ slug: item.slug }}
              search={fromAll ? { from: "all" } : {}}
              to="/item/$slug"
            >
              <div className="flex items-center justify-between rounded-md px-2 py-2 hover:bg-accent">
                <span className="text-sm font-medium">{item.title}</span>
                <span className="flex items-center gap-2">
                  <small className="text-xs text-muted-foreground">
                    {item.status === "borrowed" && item.borrower
                      ? `With ${item.borrower}`
                      : "Reading"}
                  </small>
                  <Badge variant="outline">
                    {item.status === "reading" ? "Reading" : "Borrowed"}
                  </Badge>
                </span>
              </div>
            </Link>
          ))}
        </CardContent>
      </Card>
    </section>
  )
}
