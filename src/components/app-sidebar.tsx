"use client"

import { Link, useRouter } from "@tanstack/react-router"
import { BookOpenIcon, LogInIcon, LogOutIcon, SearchIcon, FilmIcon } from "lucide-react"
import { useEffect, useState } from "react"
import { getAdminStatus, logout } from "@/server/items"
import { CatalogCommand } from "@/components/catalog-command"
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarRail,
} from "@/components/ui/sidebar"

const navigation = [
  { title: "Books", to: "/books", icon: BookOpenIcon },
  { title: "Movies", to: "/movies", icon: FilmIcon },
] as const

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const router = useRouter()
  const [admin, setAdmin] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  useEffect(() => { getAdminStatus().then(setAdmin).catch(() => setAdmin(false)) }, [])
  async function signOut() {
    await logout()
    setAdmin(false)
    await router.navigate({ to: "/books" })
  }
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu><SidebarMenuItem>
          <SidebarMenuButton render={<Link to="/books" />} size="lg" tooltip="Shelf">
            <div className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">S</div>
            <div className="grid flex-1 text-left text-sm leading-tight"><span className="truncate font-semibold">Shelf</span><span className="truncate text-xs">Ryan Leichty’s collection</span></div>
          </SidebarMenuButton>
        </SidebarMenuItem></SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent><SidebarMenu>
            <SidebarMenuItem><SidebarMenuButton onClick={() => setSearchOpen(true)} tooltip="Search"><SearchIcon /><span>Search</span></SidebarMenuButton></SidebarMenuItem>
            {navigation.map((item) => <SidebarMenuItem key={item.to}>
            <SidebarMenuButton render={<Link to={item.to} />} tooltip={item.title}><item.icon /><span>{item.title}</span></SidebarMenuButton>
            </SidebarMenuItem>)}
          </SidebarMenu></SidebarGroupContent>
        </SidebarGroup>
        {admin && <SidebarGroup>
          <SidebarGroupLabel>Manage</SidebarGroupLabel>
          <SidebarGroupContent><SidebarMenu>
            <SidebarMenuItem><SidebarMenuButton render={<Link to="/admin" />} tooltip="Admin"><BookOpenIcon /><span>Admin</span></SidebarMenuButton></SidebarMenuItem>
          </SidebarMenu></SidebarGroupContent>
        </SidebarGroup>}
      </SidebarContent>
      <SidebarFooter><SidebarMenu><SidebarMenuItem>
        {admin ? <SidebarMenuButton onClick={signOut} tooltip="Log out"><LogOutIcon /><span>Log out</span></SidebarMenuButton> : <SidebarMenuButton render={<Link to="/admin/login" />} tooltip="Log in"><LogInIcon /><span>Log in</span></SidebarMenuButton>}
      </SidebarMenuItem></SidebarMenu></SidebarFooter>
      <SidebarRail />
      <CatalogCommand onOpenChange={setSearchOpen} open={searchOpen} />
    </Sidebar>
  )
}
