"use client"

import { useRouter } from "@tanstack/react-router"
import { BookmarkIcon } from "lucide-react"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  addItemToList,
  getAdminStatus,
  removeItemFromList,
} from "@/server/items"

export function ItemListToggle({
  itemId,
  listName,
  listSlug,
  initiallyInList,
}: {
  itemId: number
  listName: string
  listSlug: string
  initiallyInList: boolean
}) {
  const router = useRouter()
  const [admin, setAdmin] = useState(false)
  const [inList, setInList] = useState(initiallyInList)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    getAdminStatus()
      .then(setAdmin)
      .catch(() => setAdmin(false))
  }, [])

  if (!admin) return null

  async function toggle() {
    setSaving(true)
    setError("")
    try {
      if (inList) {
        await removeItemFromList({ data: { itemId, listSlug } })
      } else {
        await addItemToList({ data: { itemId, listSlug } })
      }
      setInList(!inList)
      await router.invalidate()
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : `Could not update ${listName}.`
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-4">
      <Button
        aria-label={inList ? `In ${listName}` : `Add to ${listName}`}
        disabled={saving}
        onClick={toggle}
        size="icon"
        variant={inList ? "secondary" : "outline"}
      >
        <BookmarkIcon fill={inList ? "currentColor" : "none"} />
      </Button>
      {error && (
        <p className="mt-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
