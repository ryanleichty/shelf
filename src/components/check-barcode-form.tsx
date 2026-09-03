"use client"

import { useCallback, useState } from "react"
import { BarcodeScanner } from "@/components/barcode-scanner"
import { Field, FieldDescription, FieldError } from "@/components/ui/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import { Spinner } from "@/components/ui/spinner"
import { checkBarcode } from "@/server/barcode"

export type CheckBarcodeResult = Awaited<ReturnType<typeof checkBarcode>>

export function CheckBarcodeForm({
  active = true,
  onCheckStart,
  onResult,
}: {
  active?: boolean
  onCheckStart?: () => void
  onResult: (result: CheckBarcodeResult, code: string) => void
}) {
  const [code, setCode] = useState("")
  const [error, setError] = useState("")
  const [checking, setChecking] = useState(false)
  const [scannerReset, setScannerReset] = useState(0)

  const submitCode = useCallback(
    async (value: string) => {
      if (checking) return
      setChecking(true)
      setError("")
      onCheckStart?.()
      try {
        onResult(await checkBarcode({ data: { code: value } }), value)
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
    [checking, onCheckStart, onResult]
  )

  return (
    <div className="flex flex-col gap-5">
      <BarcodeScanner
        active={active}
        onDetected={(value) => {
          setCode(value)
          void submitCode(value)
        }}
        stopSignal={scannerReset}
      />
      <form
        onSubmit={(event) => {
          event.preventDefault()
          setScannerReset((current) => current + 1)
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
                aria-label="Scan barcode"
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
  )
}
