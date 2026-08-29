"use client"

import { Link, useRouter } from "@tanstack/react-router"
import { PencilIcon, Trash2Icon } from "lucide-react"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
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
  return <div className="mt-6 flex gap-2">
    <Button render={<Link params={{ id: String(id) }} to="/admin/$id" />} variant="outline"><PencilIcon /> Edit</Button>
    <Button disabled={!providerId || syncing} onClick={sync} variant="outline">{syncing ? "Syncing…" : `Sync from ${type === "book" ? "Open Library" : "TMDB"}`}</Button>
    <Button onClick={remove} variant="destructive"><Trash2Icon /> Delete</Button>
    {syncError && <p className="w-full text-sm text-destructive" role="alert">{syncError}</p>}
  </div>
}
