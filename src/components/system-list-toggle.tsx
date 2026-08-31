"use client"

import { useEffect, useRef, useState } from "react"
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
  showTooltip = !showLabel,
  variant,
}: {
  className?: string
  itemId: number
  list: SystemListOption
  onError?: (message: string) => void
  onMembershipChange?: (containsItem: boolean) => void
  showLabel?: boolean
  showTooltip?: boolean
  variant?: "default" | "outline"
}) {
  const router = useRouter()
  const [containsItem, setContainsItem] = useState(list.containsItem)
  const containsItemRef = useRef(containsItem)
  const requestGeneration = useRef(0)
  const activeRequestGeneration = useRef<number | null>(null)

  useEffect(() => {
    if (activeRequestGeneration.current !== null) return
    containsItemRef.current = list.containsItem
    setContainsItem(list.containsItem)
  }, [list.containsItem])

  async function toggle() {
    const previousContainsItem = containsItemRef.current
    const nextContainsItem = !previousContainsItem
    const generation = ++requestGeneration.current
    activeRequestGeneration.current = generation
    onError?.("")
    containsItemRef.current = nextContainsItem
    setContainsItem(nextContainsItem)
    onMembershipChange?.(nextContainsItem)
    try {
      if (previousContainsItem)
        await removeItemFromList({ data: { itemId, listSlug: list.slug } })
      else await addItemToList({ data: { itemId, listSlug: list.slug } })
      if (generation !== requestGeneration.current) return
      await router.invalidate()
    } catch (cause) {
      if (generation !== requestGeneration.current) return
      containsItemRef.current = previousContainsItem
      setContainsItem(previousContainsItem)
      onMembershipChange?.(previousContainsItem)
      onError?.(
        cause instanceof Error
          ? cause.message
          : `Could not update ${list.name}.`
      )
    } finally {
      if (generation === requestGeneration.current)
        activeRequestGeneration.current = null
    }
  }

  const button = (
    <Button
      aria-label={`${containsItem ? "Remove from" : "Add to"} ${list.name}`}
      className={className}
      onClick={() => void toggle()}
      size={showLabel ? "default" : "icon"}
      variant={variant ?? (showLabel && containsItem ? "default" : "outline")}
    >
      <BookmarkIcon
        data-icon={showLabel ? "inline-start" : undefined}
        fill={containsItem ? "currentColor" : "none"}
      />
      {showLabel && list.name}
    </Button>
  )

  return showTooltip ? (
    <Tooltip>
      <TooltipTrigger render={button} />
      <TooltipContent>{list.name}</TooltipContent>
    </Tooltip>
  ) : (
    button
  )
}
