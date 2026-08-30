"use client"

import { useEffect, useState } from "react"
import { useRouter } from "@tanstack/react-router"
import { BookmarkIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { addItemToList, removeItemFromList } from "@/server/lists"

export type SystemListOption = {
  slug: string
  name: string
  containsItem: boolean
}

export function SystemListToggle({
  className,
  itemId,
  list,
  onError,
  onMembershipChange,
  showLabel = false,
}: {
  className?: string
  itemId: number
  list: SystemListOption
  onError?: (message: string) => void
  onMembershipChange?: (containsItem: boolean) => void
  showLabel?: boolean
}) {
  const router = useRouter()
  const [containsItem, setContainsItem] = useState(list.containsItem)
  const [pending, setPending] = useState(false)

  useEffect(() => setContainsItem(list.containsItem), [list.containsItem])

  async function toggle() {
    setPending(true)
    onError?.("")
    try {
      if (containsItem)
        await removeItemFromList({ data: { itemId, listSlug: list.slug } })
      else await addItemToList({ data: { itemId, listSlug: list.slug } })
      const nextContainsItem = !containsItem
      setContainsItem(nextContainsItem)
      onMembershipChange?.(nextContainsItem)
      await router.invalidate()
    } catch (cause) {
      onError?.(
        cause instanceof Error
          ? cause.message
          : `Could not update ${list.name}.`
      )
    } finally {
      setPending(false)
    }
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            aria-label={`${containsItem ? "Remove from" : "Add to"} ${list.name}`}
            className={className}
            disabled={pending}
            onClick={() => void toggle()}
            size={showLabel ? "default" : "icon"}
            variant={showLabel && containsItem ? "default" : "outline"}
          >
            <BookmarkIcon
              data-icon={showLabel ? "inline-start" : undefined}
              fill={containsItem ? "currentColor" : "none"}
            />
            {showLabel && list.name}
          </Button>
        }
      />
      <TooltipContent>{list.name}</TooltipContent>
    </Tooltip>
  )
}
