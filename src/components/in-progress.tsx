import { Link } from "@tanstack/react-router"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { CatalogItem, ItemProgressState } from "@/lib/catalog"

export function InProgress({
  items,
  viewerStates,
  fromAll = false,
}: {
  items: CatalogItem[]
  viewerStates: Record<number, ItemProgressState>
  fromAll?: boolean
}) {
  const inProgress = items.filter((item) => viewerStates[item.id])
  if (!inProgress.length) return null
  const mixed =
    new Set(inProgress.map((item) => viewerStates[item.id])).size > 1
  return (
    <section className="mb-8" aria-labelledby="in-progress-heading">
      <Card>
        <CardHeader className="pb-2">
          <p className="text-sm text-muted-foreground">In motion</p>
          <CardTitle id="in-progress-heading">
            {mixed ? "In progress" : "You're reading"}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2">
          {inProgress.map((item) => (
            <Link
              key={item.id}
              params={{ slug: item.slug }}
              search={fromAll ? { from: "all" } : {}}
              to="/item/$slug"
            >
              <div className="flex items-center justify-between rounded-md px-2 py-2 hover:bg-accent">
                <span className="text-sm font-medium">{item.title}</span>
                <Badge variant="outline">
                  {viewerStates[item.id] === "reading" ? "Reading" : "Watching"}
                </Badge>
              </div>
            </Link>
          ))}
        </CardContent>
      </Card>
    </section>
  )
}
