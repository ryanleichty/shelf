"use client"

import { useEffect, useState } from "react"
import { useRouter } from "@tanstack/react-router"
import { ListPlusIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CreateListDialog } from "@/components/create-list-dialog"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { getSignedInStatus } from "@/server/items"
import { addItemToList, removeItemFromList } from "@/server/lists"

type ListOption = { slug: string; name: string; containsItem: boolean }

export function ItemListMenu({
  itemId,
  itemType,
  lists,
}: {
  itemId: number
  itemType: "book" | "movie" | "tv"
  lists: ListOption[]
}) {
  const router = useRouter()
  const [signedIn, setSignedIn] = useState(false)
  const [error, setError] = useState("")
  const [newListOpen, setNewListOpen] = useState(false)

  useEffect(() => {
    getSignedInStatus()
      .then(setSignedIn)
      .catch(() => setSignedIn(false))
  }, [])

  if (!signedIn) return null

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
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setNewListOpen(true)}>
            New list
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <CreateListDialog
        defaultType={itemType}
        onCreated={router.invalidate}
        onOpenChange={setNewListOpen}
        open={newListOpen}
      />
      {error && (
        <p className="mt-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
