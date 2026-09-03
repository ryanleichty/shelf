import { Link } from "@tanstack/react-router"
import { PlusIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import type { checkBarcode } from "@/server/barcode"

type CheckBarcodeResult = Awaited<ReturnType<typeof checkBarcode>>

export function CheckBarcodeResult({
  code,
  result,
}: {
  code: string
  result: CheckBarcodeResult
}) {
  if (result.status === "owned") {
    return (
      <Card>
        <CardContent className="flex gap-4">
          <div className="size-20 shrink-0 overflow-hidden rounded-md bg-muted">
            {result.item.coverImageUrl && (
              <img
                alt=""
                className="h-full w-full object-cover"
                referrerPolicy="no-referrer"
                src={result.item.coverImageUrl}
              />
            )}
          </div>
          <div className="min-w-0">
            <h2 className="truncate font-semibold">{result.item.title}</h2>
            <Link
              className="mt-2 inline-block text-sm text-primary underline-offset-4 hover:underline"
              params={{ slug: result.item.slug }}
              to="/item/$slug"
            >
              {result.item.status === "wanted"
                ? "On your wishlist"
                : "On the shelf"}
            </Link>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="text-sm text-muted-foreground">
        <p>Not on the shelf.</p>
        {result.title && (
          <p className="mt-1">
            {result.title}
            {result.year ? ` · ${result.year}` : ""}
            {result.format ? ` · ${result.format}` : ""}
          </p>
        )}
        <div className="mt-3 flex gap-2">
          <Button
            render={<Link search={{ barcode: code }} to="/admin/new" />}
            size="sm"
          >
            <PlusIcon /> Add to Shelf
          </Button>
          <Button
            render={
              <Link search={{ barcode: code, wanted: true }} to="/admin/new" />
            }
            size="sm"
            variant="outline"
          >
            <PlusIcon /> Add to Wishlist
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
