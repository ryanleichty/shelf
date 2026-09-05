"use client"

import { Link } from "@tanstack/react-router"
import {
  ArrowRightIcon,
  BookmarkIcon,
  CircleCheckIcon,
  CircleDashedIcon,
  PlusIcon,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { coverPlateBackground } from "@/lib/cover-plate"
import {
  editionLabel,
  formatRuntime,
  normalizeTitle,
  statusLabel,
  type CatalogItem,
} from "@/lib/catalog"
import { useCatalog } from "@/lib/use-catalog"
import { cn } from "@/lib/utils"
import type { checkBarcode } from "@/server/barcode"

type CheckBarcodeResult = Awaited<ReturnType<typeof checkBarcode>>

type Preview = {
  slug: string
  type: CatalogItem["type"]
  title: string
  creator: string
  year: number | null
  coverImageUrl: string | null
  genres: string[]
  description?: string | null
  format?: string | null
  edition?: string | null
  certification?: string | null
  runtime?: number | null
  pageCount?: number | null
}

export function CheckBarcodeResult({
  code,
  result,
}: {
  code: string
  result: CheckBarcodeResult
}) {
  const catalog = useCatalog()

  if (result.status === "owned") {
    const { item } = result
    const shelfItem = [...catalog.items, ...catalog.wishlist].find(
      (candidate) => candidate.id === item.id
    )
    const verdict =
      item.status === "wanted"
        ? "On your wishlist"
        : item.status === "borrowed"
          ? shelfItem?.borrower
            ? `On the shelf, lent to ${shelfItem.borrower}`
            : "On the shelf, lent out"
          : "On the shelf"
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {item.status === "wanted" ? (
              <BookmarkIcon className="size-4 shrink-0" />
            ) : (
              <CircleCheckIcon className="size-4 shrink-0 text-primary" />
            )}
            {verdict}
          </CardTitle>
          <CardDescription>Barcode {code}</CardDescription>
        </CardHeader>
        <CardContent>
          <ItemPreview preview={{ ...item, genres: shelfItem?.genres ?? [] }} />
        </CardContent>
        <CardFooter>
          <Button
            className="w-full"
            render={<Link params={{ slug: item.slug }} to="/item/$slug" />}
            variant="outline"
          >
            Open item <ArrowRightIcon data-icon="inline-end" />
          </Button>
        </CardFooter>
      </Card>
    )
  }

  const title =
    result.status === "resolved" ? result.result.title : result.title
  const similar = title ? similarItems(catalog, title) : []

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CircleDashedIcon className="size-4 shrink-0 text-muted-foreground" />
          Not on the shelf
        </CardTitle>
        <CardDescription>Barcode {code}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {result.status === "resolved" ? (
          <ItemPreview
            preview={{
              ...result.result,
              slug: result.result.id,
              format: result.format,
            }}
          />
        ) : result.title ? (
          <p className="text-muted-foreground">
            The barcode is {result.title}
            {result.year ? ` (${result.year})` : ""}
            {result.format ? ` on ${result.format}` : ""}, but nothing in the
            catalog matched it.
          </p>
        ) : (
          <p className="text-muted-foreground">
            No catalog knows this barcode. Try searching by title instead.
          </p>
        )}
        {similar.length > 0 && (
          <div className="flex flex-col gap-2">
            <CardDescription>Similar titles you have</CardDescription>
            <ul className="flex flex-col gap-1">
              {similar.map((item) => (
                <li key={item.id}>
                  <Link
                    className="flex items-center gap-3 rounded-md p-1 hover:bg-muted"
                    params={{ slug: item.slug }}
                    to="/item/$slug"
                  >
                    <ShelfItemSummary item={item} />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
      <CardFooter className="gap-2">
        <Button
          className="flex-1"
          render={<Link search={{ barcode: code }} to="/admin/new" />}
        >
          <PlusIcon data-icon="inline-start" /> Add to Shelf
        </Button>
        <Button
          className="flex-1"
          render={
            <Link search={{ barcode: code, wanted: true }} to="/admin/new" />
          }
          variant="outline"
        >
          <PlusIcon data-icon="inline-start" /> Wishlist
        </Button>
      </CardFooter>
    </Card>
  )
}

// Cover, title, creator · year, status for a shelf item. Callers wrap it in
// a Link or a CommandItem, so it renders no interactive element itself.
export function ShelfItemSummary({ item }: { item: CatalogItem }) {
  return (
    <>
      <Cover className="h-12" preview={item} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{item.title}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {[item.creator, item.year].filter(Boolean).join(" · ")}
        </span>
      </span>
      {item.status !== "owned" && (
        <Badge className="shrink-0" variant="outline">
          {statusLabel(item.status)}
        </Badge>
      )}
    </>
  )
}

function ItemPreview({ preview }: { preview: Preview }) {
  const meta = [
    preview.type,
    preview.year,
    preview.type === "book" && preview.pageCount
      ? `${preview.pageCount} pages`
      : preview.runtime
        ? formatRuntime(preview.runtime)
        : null,
    preview.certification,
  ].filter(Boolean)
  const badges = [
    preview.format,
    preview.edition ? editionLabel(preview.edition) : null,
  ].filter(Boolean)
  return (
    <div className="flex gap-4">
      <Cover className="h-36" preview={preview} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="text-xs text-muted-foreground capitalize">
          {meta.join(" · ")}
        </p>
        <CardTitle>{preview.title}</CardTitle>
        {preview.creator && (
          <p className="text-muted-foreground">{preview.creator}</p>
        )}
        {(badges.length > 0 || preview.genres.length > 0) && (
          <div className="flex flex-wrap gap-1 pt-1">
            {badges.map((badge) => (
              <Badge className="capitalize" key={badge} variant="secondary">
                {badge}
              </Badge>
            ))}
            {preview.genres.slice(0, 3).map((genre) => (
              <Badge key={genre} variant="outline">
                {genre}
              </Badge>
            ))}
          </div>
        )}
        {preview.description && (
          <p className="line-clamp-3 pt-1 text-muted-foreground">
            {preview.description}
          </p>
        )}
      </div>
    </div>
  )
}

function Cover({
  className,
  preview,
}: {
  className?: string
  preview: Pick<Preview, "slug" | "title" | "coverImageUrl">
}) {
  return (
    <div
      className={cn(
        "aspect-2/3 shrink-0 overflow-hidden rounded-md bg-muted",
        className
      )}
      style={
        preview.coverImageUrl
          ? undefined
          : { backgroundColor: coverPlateBackground(preview.slug) }
      }
    >
      {preview.coverImageUrl && (
        <img
          alt=""
          className="h-full w-full object-cover"
          referrerPolicy="no-referrer"
          src={preview.coverImageUrl}
        />
      )}
    </div>
  )
}

// A disc's year is often its release year, not the film's, so an exact
// title+year miss on the server can still be a title you own.
function similarItems(
  catalog: { items: CatalogItem[]; wishlist: CatalogItem[] },
  title: string
) {
  const needle = normalizeTitle(title)
  if (needle.length < 3) return []
  return [...catalog.items, ...catalog.wishlist]
    .filter((item) => normalizeTitle(item.title).includes(needle))
    .slice(0, 4)
}
