"use client"

import { useRouter } from "@tanstack/react-router"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import type { ItemProgressState, ItemType } from "@/lib/catalog"
import { clearItemState, setItemState } from "@/server/user-items"

export function ItemStateToggle({
  itemId,
  type,
  state,
  signedIn,
}: {
  itemId: number
  type: ItemType
  state: ItemProgressState | null
  signedIn: boolean
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  if (!signedIn) return null

  const targetState = type === "book" ? "reading" : "watching"
  const active = state === targetState
  const label =
    targetState === "reading" ? "I'm reading this" : "I'm watching this"
  const activeLabel =
    targetState === "reading" ? "Stop reading" : "Stop watching"

  async function toggle() {
    setBusy(true)
    setError("")
    try {
      if (active) await clearItemState({ data: { itemId } })
      else await setItemState({ data: { itemId, state: targetState } })
      await router.invalidate()
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not update this item."
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <Button disabled={busy} onClick={toggle} variant="outline">
        {active ? activeLabel : label}
      </Button>
      {error && (
        <p className="text-right text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
