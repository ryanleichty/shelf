"use client"

import { useState } from "react"
import { CheckBarcodeForm } from "@/components/check-barcode-form"
import { CheckBarcodeResult } from "@/components/check-barcode-result"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { checkBarcode } from "@/server/items"

type CheckResult = Awaited<ReturnType<typeof checkBarcode>>

export function CheckBarcodeDialog({
  onOpenChange,
  open,
}: {
  onOpenChange: (open: boolean) => void
  open: boolean
}) {
  const [result, setResult] = useState<CheckResult | null>(null)

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
          <DialogTitle>Scan barcode</DialogTitle>
        </DialogHeader>
        {open && (
          <CheckBarcodeForm
            active={open}
            onCheckStart={() => setResult(null)}
            onResult={setResult}
          />
        )}
        {result && <CheckBarcodeResult result={result} />}
      </DialogContent>
    </Dialog>
  )
}
