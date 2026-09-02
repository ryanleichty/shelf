"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
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
import {
  SystemListToggle,
  type SystemListOption,
} from "@/components/system-list-toggle"
import { addItemToList, removeItemFromList } from "@/server/lists"

type ListOption = { slug: string; name: string; containsItem: boolean }

export function ItemListMenu({
  itemId,
  itemType,
  lists,
  signedIn,
  systemList,
  trailer,
}: {
  itemId: number
  itemType: "book" | "movie" | "tv"
  lists: ListOption[]
  signedIn: boolean
  systemList: SystemListOption | null
  trailer?: ReactNode
}) {
  const router = useRouter()
  const [customLists, setCustomLists] = useState(lists)
  const [bookmark, setBookmark] = useState(systemList)
  const [error, setError] = useState("")
  const [newListOpen, setNewListOpen] = useState(false)
  const customListsRef = useRef(lists)
  const bookmarkRef = useRef(systemList)
  const listRequestGenerations = useRef(new Map<string, number>())
  const optimisticListValues = useRef(new Map<string, boolean>())
  const optimisticBookmarkValue = useRef<boolean | null>(null)

  useEffect(() => {
    const nextLists = lists.map((list) => {
      const optimisticList = customListsRef.current.find(
        (candidate) => candidate.slug === list.slug
      )
      const optimisticValue = optimisticListValues.current.get(list.slug)
      if (
        optimisticList &&
        optimisticValue !== undefined &&
        list.containsItem !== optimisticValue
      )
        return { ...list, containsItem: optimisticList.containsItem }
      return list
    })
    customListsRef.current = nextLists
    setCustomLists(nextLists)
  }, [lists])
  useEffect(() => {
    if (
      optimisticBookmarkValue.current !== null &&
      systemList?.containsItem !== optimisticBookmarkValue.current
    )
      return
    bookmarkRef.current = systemList
    setBookmark(systemList)
  }, [systemList])

  if (!signedIn)
    return trailer ? (
      <div className="mt-4 flex items-center gap-2">{trailer}</div>
    ) : null

  async function toggleList(list: ListOption) {
    const currentList = customListsRef.current.find(
      (candidate) => candidate.slug === list.slug
    )
    if (!currentList) return
    const previousContainsItem = currentList.containsItem
    const nextContainsItem = !previousContainsItem
    const generation = (listRequestGenerations.current.get(list.slug) ?? 0) + 1
    listRequestGenerations.current.set(list.slug, generation)
    optimisticListValues.current.set(list.slug, nextContainsItem)
    setError("")
    const nextLists = customListsRef.current.map((candidate) =>
      candidate.slug === list.slug
        ? { ...candidate, containsItem: nextContainsItem }
        : candidate
    )
    customListsRef.current = nextLists
    setCustomLists(nextLists)
    try {
      if (previousContainsItem)
        await removeItemFromList({ data: { itemId, listSlug: list.slug } })
      else await addItemToList({ data: { itemId, listSlug: list.slug } })
      if (listRequestGenerations.current.get(list.slug) !== generation) return
      void router.invalidate()
    } catch (cause) {
      if (listRequestGenerations.current.get(list.slug) !== generation) return
      const revertedLists = customListsRef.current.map((candidate) =>
        candidate.slug === list.slug
          ? { ...candidate, containsItem: previousContainsItem }
          : candidate
      )
      customListsRef.current = revertedLists
      setCustomLists(revertedLists)
      optimisticListValues.current.delete(list.slug)
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
          onMembershipChange={(containsItem) => {
            if (!bookmarkRef.current) return
            const nextBookmark = {
              ...bookmarkRef.current,
              containsItem,
            }
            bookmarkRef.current = nextBookmark
            optimisticBookmarkValue.current = containsItem
            setBookmark(nextBookmark)
          }}
          showLabel
        />
      )}
      {trailer}
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
