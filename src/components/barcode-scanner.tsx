import { useCallback, useEffect, useRef, useState } from "react"
import { CameraIcon, ScanLineIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { FieldError } from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"

type ScannerControls = { stop: () => void }

export function BarcodeScanner({
  active = true,
  onDetected,
  stopSignal,
}: {
  active?: boolean
  onDetected: (code: string) => void
  stopSignal?: number
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const scannerControls = useRef<ScannerControls | null>(null)
  const mediaStream = useRef<MediaStream | null>(null)
  const detectionTimer = useRef<number | null>(null)
  const handlingCode = useRef(false)
  const [error, setError] = useState("")
  const [scanning, setScanning] = useState(false)
  const [starting, setStarting] = useState(false)

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
    setStarting(false)
  }, [])

  useEffect(() => {
    if (!active) stopScanner()
  }, [active, stopScanner])
  useEffect(() => {
    stopScanner()
  }, [stopSignal, stopScanner])
  useEffect(() => stopScanner, [stopScanner])

  const handleDetectedCode = useCallback(
    (code: string) => {
      if (handlingCode.current) return
      handlingCode.current = true
      stopScanner()
      onDetected(code)
    },
    [onDetected, stopScanner]
  )

  const startScanner = useCallback(async () => {
    setError("")
    handlingCode.current = false
    setStarting(true)
    setScanning(true)
    await new Promise<void>((resolve) =>
      window.requestAnimationFrame(() => resolve())
    )
    if (!videoRef.current) {
      stopScanner()
      return
    }
    try {
      const Detector = (
        window as unknown as {
          BarcodeDetector?: new (options: { formats: string[] }) => {
            detect: (
              source: HTMLVideoElement
            ) => Promise<Array<{ rawValue?: string }>>
          }
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
      } else {
        const { BrowserMultiFormatReader } = await import("@zxing/browser")
        const reader = new BrowserMultiFormatReader()
        scannerControls.current = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: "environment" } }, audio: false },
          videoRef.current,
          (decoded) => {
            if (decoded) handleDetectedCode(decoded.getText())
          }
        )
      }
      setStarting(false)
    } catch {
      stopScanner()
      setError("Camera access is unavailable. Type or paste the code instead.")
    }
  }, [handleDetectedCode, stopScanner])

  return (
    <div className="flex flex-col gap-3">
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
        disabled={starting}
        onClick={scanning ? stopScanner : startScanner}
        type="button"
        variant={scanning ? "outline" : "default"}
      >
        {starting ? (
          <Spinner data-icon="inline-start" />
        ) : scanning ? (
          <CameraIcon data-icon="inline-start" />
        ) : (
          <ScanLineIcon data-icon="inline-start" />
        )}
        {starting
          ? "Starting camera…"
          : scanning
            ? "Stop camera"
            : "Scan barcode"}
      </Button>
      {error && <FieldError>{error}</FieldError>}
    </div>
  )
}
