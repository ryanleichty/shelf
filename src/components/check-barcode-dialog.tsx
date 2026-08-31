"use client"

import { useCallback, useState } from "react"
import { Link } from "@tanstack/react-router"
import { BarcodeScanner } from "@/components/barcode-scanner"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldDescription, FieldError } from "@/components/ui/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import { Spinner } from "@/components/ui/spinner"
import { checkBarcode } from "@/server/items"

type CheckResult = Awaited<ReturnType<typeof checkBarcode>>

export function CheckBarcodeDialog({
  onOpenChange,
  open,
}: {
  onOpenChange: (open: boolean) => void
  open: boolean
}) {
  const [code, setCode] = useState("")
  const [result, setResult] = useState<CheckResult | null>(null)
  const [error, setError] = useState("")
  const [checking, setChecking] = useState(false)

  const submitCode = useCallback(
    async (value: string) => {
      if (checking) return
      setChecking(true)
      setError("")
      setResult(null)
      try {
        setResult(await checkBarcode({ data: { code: value } }))
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : "Could not check that barcode. Try again."
        )
      } finally {
        setChecking(false)
      }
    },
    [checking]
  )

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen)
    if (!nextOpen) {
      setCode("")
      setResult(null)
      setError("")
    }
  }

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Check Shelf</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-5">
          {open && (
            <BarcodeScanner
              active={open}
              onDetected={(value) => {
                setCode(value)
                void submitCode(value)
              }}
            />
          )}
          <form
            onSubmit={(event) => {
              event.preventDefault()
              void submitCode(code)
            }}
          >
            <Field data-invalid={Boolean(error)}>
              <InputGroup>
                <InputGroupInput
                  aria-invalid={Boolean(error)}
                  aria-label="Barcode, UPC, or ISBN"
                  autoComplete="off"
                  inputMode="numeric"
                  onChange={(event) => setCode(event.target.value)}
                  placeholder="Type or paste a code"
                  value={code}
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupButton
                    aria-label="Check barcode"
                    disabled={checking || !code.trim()}
                    type="submit"
                  >
                    {checking && <Spinner data-icon="inline-start" />}
                    Check
                  </InputGroupButton>
                </InputGroupAddon>
              </InputGroup>
              <FieldDescription>
                EAN-13, UPC-A, ISBN-10, or ISBN-13
              </FieldDescription>
              {error && <FieldError>{error}</FieldError>}
            </Field>
          </form>
        </div>
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
