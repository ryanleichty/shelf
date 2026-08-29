"use client"

import { Link, useRouter } from "@tanstack/react-router"
import { PencilIcon, Trash2Icon } from "lucide-react"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { deleteItem, getAdminStatus } from "@/server/items"

export function ItemAdminActions({ id, title, type }: { id: number; title: string; type: "book" | "movie" | "tv" }) {
  const router = useRouter()
  const [admin, setAdmin] = useState(false)
  useEffect(() => { getAdminStatus().then(setAdmin).catch(() => setAdmin(false)) }, [])
  if (!admin) return null
  async function remove() {
    if (!window.confirm(`Remove “${title}” from Shelf?`)) return
    await deleteItem({ data: { id } })
    await router.navigate({ to: type === "book" ? "/books" : type === "tv" ? "/tv" : "/movies" })
  }
  return <div className="mt-6 flex gap-2">
    <Button render={<Link params={{ id: String(id) }} to="/admin/$id" />} variant="outline"><PencilIcon /> Edit</Button>
    <Button onClick={remove} variant="destructive"><Trash2Icon /> Delete</Button>
  </div>
}
