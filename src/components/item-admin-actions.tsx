"use client"

import { Link, useRouter } from "@tanstack/react-router"
import { EllipsisIcon, PencilIcon, Trash2Icon } from "lucide-react"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { deleteItem, getAdminStatus, syncItem } from "@/server/items"

export function ItemAdminActions({ id, title, type, providerId }: { id: number; title: string; type: "book" | "movie" | "tv"; providerId: string | null }) {
  const router = useRouter()
  const [admin, setAdmin] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncError, setSyncError] = useState("")
  useEffect(() => { getAdminStatus().then(setAdmin).catch(() => setAdmin(false)) }, [])
  if (!admin) return null
  async function remove() {
    if (!window.confirm(`Remove “${title}” from Shelf?`)) return
    await deleteItem({ data: { id } })
    await router.navigate({ to: type === "book" ? "/books" : type === "tv" ? "/tv" : "/movies" })
  }
  async function sync() {
    setSyncing(true)
    setSyncError("")
    try {
      await syncItem({ data: { id } })
      await router.invalidate()
    } catch (cause) {
      setSyncError(cause instanceof Error ? cause.message : "Could not sync this item.")
    } finally {
      setSyncing(false)
    }
  }
  return <div className="flex flex-col items-end gap-2">
    <div className="flex gap-2">
      <Button render={<Link params={{ id: String(id) }} to="/admin/$id" />} variant="outline"><PencilIcon /> Edit</Button>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button aria-label="More item actions" size="icon" variant="outline"><EllipsisIcon /></Button>} />
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem disabled={!providerId || syncing} onClick={sync}>
            {syncing ? "Syncing…" : `Sync from ${type === "book" ? "Open Library" : "TMDB"}`}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={remove} variant="destructive">
            <Trash2Icon /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
    {syncError && <p className="text-right text-sm text-destructive" role="alert">{syncError}</p>}
  </div>
}
