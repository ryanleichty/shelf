import { useState } from "react"
import { createFileRoute, redirect } from "@tanstack/react-router"
import { CheckBarcodeForm } from "@/components/check-barcode-form"
import { CheckBarcodeResult } from "@/components/check-barcode-result"
import { checkBarcode, getAdminStatus } from "@/server/items"

type CheckResult = Awaited<ReturnType<typeof checkBarcode>>

export const Route = createFileRoute("/check")({
  beforeLoad: async () => {
    if (!(await getAdminStatus())) throw redirect({ to: "/admin/login" })
  },
  component: Check,
})

function Check() {
  const [result, setResult] = useState<CheckResult | null>(null)

  return (
    <main className="container mx-auto max-w-md px-4 py-6 sm:py-10">
      <p className="text-sm text-muted-foreground">Private index</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">
        Check Shelf
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Scan a barcode before you buy.
      </p>

      <div className="mt-6 flex flex-col gap-5">
        <CheckBarcodeForm
          onCheckStart={() => setResult(null)}
          onResult={setResult}
        />
      </div>

      {result && (
        <div className="mt-6">
          <CheckBarcodeResult result={result} />
        </div>
      )}
    </main>
  )
}
