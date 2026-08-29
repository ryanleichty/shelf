"use client"

import { useRouter } from "@tanstack/react-router"
import { BookmarkIcon } from "lucide-react"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
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

  const actionLabel = inList ? `Remove from ${listName}` : `Add to ${listName}`

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
      <Tooltip>
        <TooltipTrigger
          render={
            saving ? (
              <span className="inline-flex">
                <Button
                  aria-label={actionLabel}
                  disabled
                  onClick={toggle}
                  size="icon"
                  variant={inList ? "secondary" : "outline"}
                >
                  <BookmarkIcon fill={inList ? "currentColor" : "none"} />
                </Button>
              </span>
            ) : (
              <Button
                aria-label={actionLabel}
                onClick={toggle}
                size="icon"
                variant={inList ? "secondary" : "outline"}
              >
                <BookmarkIcon fill={inList ? "currentColor" : "none"} />
              </Button>
            )
          }
        />
        <TooltipContent>
          <p>{actionLabel}</p>
        </TooltipContent>
      </Tooltip>
      {error && (
        <p className="mt-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
