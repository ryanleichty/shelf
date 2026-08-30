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
import { Skeleton } from "@/components/ui/skeleton"
import {
  SystemListToggle,
  type SystemListOption,
} from "@/components/system-list-toggle"
import { getSignedInStatus } from "@/server/items"
import { addItemToList, removeItemFromList } from "@/server/lists"

type ListOption = { slug: string; name: string; containsItem: boolean }

export function ItemListMenu({
  itemId,
  itemType,
  lists,
  systemList,
}: {
  itemId: number
  itemType: "book" | "movie" | "tv"
  lists: ListOption[]
  systemList: SystemListOption | null
}) {
  const router = useRouter()
  const [signedIn, setSignedIn] = useState<boolean | null>(null)
  const [customLists, setCustomLists] = useState(lists)
  const [bookmark, setBookmark] = useState(systemList)
  const [error, setError] = useState("")
  const [newListOpen, setNewListOpen] = useState(false)

  useEffect(() => {
    getSignedInStatus()
      .then(setSignedIn)
      .catch(() => setSignedIn(false))
  }, [])

  useEffect(() => setCustomLists(lists), [lists])
  useEffect(() => setBookmark(systemList), [systemList])

  if (signedIn === null)
    return (
      <Skeleton aria-label="Loading list controls" className="mt-4 size-9" />
    )
  if (!signedIn) return null

  async function toggleList(list: ListOption) {
    setError("")
    try {
      if (list.containsItem)
        await removeItemFromList({ data: { itemId, listSlug: list.slug } })
      else await addItemToList({ data: { itemId, listSlug: list.slug } })
      setCustomLists((current) =>
        current.map((candidate) =>
          candidate.slug === list.slug
            ? { ...candidate, containsItem: !candidate.containsItem }
            : candidate
        )
      )
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
    <div className="mt-4 flex items-center gap-2">
      {bookmark && (
        <SystemListToggle
          itemId={itemId}
          list={bookmark}
          onError={setError}
          onMembershipChange={(containsItem) =>
            setBookmark({ ...bookmark, containsItem })
          }
          showLabel
        />
      )}
      {customLists.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                aria-label="Manage custom lists"
                size="icon"
                variant="outline"
              >
                <ListPlusIcon />
              </Button>
            }
          />
          <DropdownMenuContent align="start">
            <DropdownMenuLabel>Custom lists</DropdownMenuLabel>
            <DropdownMenuGroup>
              {customLists.map((list) => (
                <DropdownMenuCheckboxItem
                  checked={list.containsItem}
                  key={list.slug}
                  onCheckedChange={() => void toggleList(list)}
                  value={list.slug}
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
      )}
      <CreateListDialog
        onCreated={router.invalidate}
        onOpenChange={setNewListOpen}
        open={newListOpen}
        type={itemType}
      />
      {error && (
        <p className="mt-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
