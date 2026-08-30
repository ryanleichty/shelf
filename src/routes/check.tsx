import { useCallback, useEffect, useRef, useState } from "react"
import { Link, createFileRoute, redirect } from "@tanstack/react-router"
import { CameraIcon, LoaderCircleIcon, ScanBarcodeIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { checkBarcode } from "@/server/items"
import { getAdminStatus } from "@/server/items"

type CheckResult = Awaited<ReturnType<typeof checkBarcode>>
type ScannerControls = { stop: () => void }

export const Route = createFileRoute("/check")({
  beforeLoad: async () => {
    if (!(await getAdminStatus())) throw redirect({ to: "/admin/login" })
  },
  component: Check,
})

function Check() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const scannerControls = useRef<ScannerControls | null>(null)
  const mediaStream = useRef<MediaStream | null>(null)
  const detectionTimer = useRef<number | null>(null)
  const handlingCode = useRef(false)
  const [code, setCode] = useState("")
  const [result, setResult] = useState<CheckResult | null>(null)
  const [error, setError] = useState("")
  const [scanning, setScanning] = useState(false)
  const [checking, setChecking] = useState(false)

  const stopScanner = useCallback(() => {
    scannerControls.current?.stop()
    scannerControls.current = null
    mediaStream.current?.getTracks().forEach((track) => track.stop())
    mediaStream.current = null
    if (detectionTimer.current !== null) {
      window.clearInterval(detectionTimer.current)
      detectionTimer.current = null
    }
    setScanning(false)
  }, [])

  useEffect(() => stopScanner, [stopScanner])

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
        handlingCode.current = false
      }
    },
    [checking]
  )

  const handleDetectedCode = useCallback(
    (value: string) => {
      if (handlingCode.current) return
      handlingCode.current = true
      stopScanner()
      setCode(value)
      void submitCode(value)
    },
    [stopScanner, submitCode]
  )

  const startScanner = useCallback(async () => {
    setError("")
    setResult(null)
    handlingCode.current = false
    setScanning(true)
    await new Promise<void>((resolve) =>
      window.requestAnimationFrame(() => resolve())
    )
    if (!videoRef.current) return
    try {
      const Detector = (
        window as unknown as {
          BarcodeDetector?: new (options: {
            formats: string[]
          }) => { detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue?: string }>> }
        }
      ).BarcodeDetector
      if (Detector) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        })
        mediaStream.current = stream
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        const detector = new Detector({
          formats: ["ean_13", "upc_a", "ean_8", "code_128"],
        })
        detectionTimer.current = window.setInterval(() => {
          if (!videoRef.current || handlingCode.current) return
          detector
            .detect(videoRef.current)
            .then((codes) => {
              const value = codes[0]?.rawValue
              if (value) handleDetectedCode(value)
            })
            .catch(() => undefined)
        }, 250)
        return
      }

      const { BrowserMultiFormatReader } = await import("@zxing/browser")
      const reader = new BrowserMultiFormatReader()
      scannerControls.current = await reader.decodeFromConstraints(
        { video: { facingMode: { ideal: "environment" } }, audio: false },
        videoRef.current,
        (decoded) => {
          if (decoded) handleDetectedCode(decoded.getText())
        }
      )
    } catch {
      stopScanner()
      setError("Camera access is unavailable. Type or paste the code instead.")
    }
  }, [handleDetectedCode, stopScanner])

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    stopScanner()
    await submitCode(code)
  }

  return (
    <main className="container mx-auto max-w-md px-4 py-6 sm:py-10">
      <p className="text-sm text-muted-foreground">Private index</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">
        Check Shelf
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Scan a barcode before you buy.
      </p>

      <div className="mt-6 space-y-3">
        {scanning && (
          <div className="overflow-hidden rounded-lg bg-muted">
            <video
              aria-label="Barcode scanner camera"
              className="aspect-square w-full object-cover"
              muted
              playsInline
              ref={videoRef}
            />
          </div>
        )}
        <Button
          className="w-full"
          onClick={scanning ? stopScanner : startScanner}
          type="button"
          variant={scanning ? "outline" : "default"}
        >
          {scanning ? <CameraIcon /> : <ScanBarcodeIcon />}
          {scanning ? "Stop camera" : "Scan barcode"}
        </Button>
      </div>

      <form className="mt-5 flex gap-2" onSubmit={submit}>
        <Input
          aria-label="Barcode, UPC, or ISBN"
          autoComplete="off"
          inputMode="numeric"
          onChange={(event) => setCode(event.target.value)}
          placeholder="Type or paste a code"
          value={code}
        />
        <Button disabled={checking || !code.trim()} type="submit">
          {checking ? <LoaderCircleIcon className="animate-spin" /> : "Check"}
        </Button>
      </form>
      <p className="mt-2 text-xs text-muted-foreground">
        EAN-13, UPC-A, ISBN-10, or ISBN-13
      </p>

      {error && (
        <p className="mt-5 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      {result?.status === "owned" && (
        <article className="mt-6 flex gap-4 rounded-lg border p-4">
          <div className="size-20 shrink-0 overflow-hidden rounded-md bg-muted">
            {result.item.coverImageUrl ? (
              <img
                alt=""
                className="h-full w-full object-cover"
                referrerPolicy="no-referrer"
                src={result.item.coverImageUrl}
              />
            ) : null}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-primary">Already on Shelf</p>
            <h2 className="mt-1 truncate font-semibold">{result.item.title}</h2>
            <p className="text-sm text-muted-foreground">
              {result.item.year}
              {result.item.format ? ` · ${formatLabel(result.item.format)}` : ""}
            </p>
            <Link
              className="mt-2 inline-block text-sm text-primary underline-offset-4 hover:underline"
              params={{ slug: result.item.slug }}
              to="/item/$slug"
            >
              View item
            </Link>
          </div>
        </article>
      )}
      {result?.status === "not-owned" && (
        <article className="mt-6 rounded-lg border p-4">
          <p className="font-medium">Doesn’t look like you own it.</p>
          {result.title && (
            <p className="mt-1 text-sm text-muted-foreground">
              {result.title}
              {result.year ? ` · ${result.year}` : ""}
              {result.format ? ` · ${result.format}` : ""}
            </p>
          )}
        </article>
      )}
    </main>
  )
}

function formatLabel(format: string) {
  return format === "blu-ray"
    ? "Blu-ray"
    : format === "dvd"
      ? "DVD"
      : format[0].toUpperCase() + format.slice(1)
}
