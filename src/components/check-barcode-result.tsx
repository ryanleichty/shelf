import { Link } from "@tanstack/react-router"
import { Card, CardContent } from "@/components/ui/card"
import { checkBarcode } from "@/server/items"

type CheckBarcodeResult = Awaited<ReturnType<typeof checkBarcode>>

export function CheckBarcodeResult({ result }: { result: CheckBarcodeResult }) {
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
              On the shelf
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
      </CardContent>
    </Card>
  )
}
