"use client"

import { useState } from "react"
import { Link } from "@tanstack/react-router"
import {
  CheckBarcodeForm,
  type CheckBarcodeResult,
} from "@/components/check-barcode-form"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export function CheckBarcodeDialog({
  onOpenChange,
  open,
}: {
  onOpenChange: (open: boolean) => void
  open: boolean
}) {
  const [result, setResult] = useState<CheckBarcodeResult | null>(null)

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen)
    if (!nextOpen) {
      setResult(null)
    }
  }

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Check Shelf</DialogTitle>
        </DialogHeader>
        {open && (
          <CheckBarcodeForm
            active={open}
            onCheckStart={() => setResult(null)}
            onResult={setResult}
          />
        )}
        {result?.status === "owned" && (
          <article className="flex gap-4 rounded-lg border p-4">
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
          </article>
        )}
        {result?.status === "not-owned" && (
          <div className="text-sm text-muted-foreground">
            <p>Not on the shelf.</p>
            {result.title && (
              <p className="mt-1">
                {result.title}
                {result.year ? ` · ${result.year}` : ""}
                {result.format ? ` · ${result.format}` : ""}
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
