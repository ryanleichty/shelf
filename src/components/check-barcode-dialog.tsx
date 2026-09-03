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
import type { checkBarcode } from "@/server/barcode"

type CheckResult = Awaited<ReturnType<typeof checkBarcode>>

export function CheckBarcodeDialog({
  onOpenChange,
  open,
}: {
  onOpenChange: (open: boolean) => void
  open: boolean
}) {
  const [checked, setChecked] = useState<{
    result: CheckResult
    code: string
  } | null>(null)

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen)
    if (!nextOpen) {
      setChecked(null)
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
            onCheckStart={() => setChecked(null)}
            onResult={(result, code) => setChecked({ result, code })}
          />
        )}
        {checked && (
          <CheckBarcodeResult code={checked.code} result={checked.result} />
        )}
      </DialogContent>
    </Dialog>
  )
}
