"use client"

import { useEffect, useState } from "react"
import { useRouter } from "@tanstack/react-router"
import { ListPlusIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { getSignedInStatus } from "@/server/items"
import { addItemToList, removeItemFromList } from "@/server/lists"

type ListOption = { slug: string; name: string; containsItem: boolean }

export function ItemListMenu({
  itemId,
  lists,
}: {
  itemId: number
  lists: ListOption[]
}) {
  const router = useRouter()
  const [signedIn, setSignedIn] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    getSignedInStatus()
      .then(setSignedIn)
      .catch(() => setSignedIn(false))
  }, [])

  if (!signedIn || !lists.length) return null

  async function toggleList(list: ListOption) {
    setError("")
    try {
      if (list.containsItem)
        await removeItemFromList({ data: { itemId, listSlug: list.slug } })
      else await addItemToList({ data: { itemId, listSlug: list.slug } })
      await router.invalidate()
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : `Could not update ${list.name}.`
      )
    }
  }

  return (
    <div className="mt-4">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button aria-label="Manage lists" size="icon" variant="outline">
              <ListPlusIcon />
            </Button>
          }
        />
        <DropdownMenuContent align="start">
          <DropdownMenuLabel>Lists</DropdownMenuLabel>
          <DropdownMenuGroup>
            {lists.map((list) => (
              <DropdownMenuCheckboxItem
                checked={list.containsItem}
                key={list.slug}
                onCheckedChange={() => void toggleList(list)}
              >
                {list.name}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      {error && (
        <p className="mt-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
