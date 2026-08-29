"use client"

import { Link, useLocation, useRouter } from "@tanstack/react-router"
import {
  BookOpenIcon,
  ChevronRightIcon,
  FilmIcon,
  HouseIcon,
  LogInIcon,
  LogOutIcon,
  SearchIcon,
  SettingsIcon,
  TvIcon,
} from "lucide-react"
import { useEffect, useState } from "react"
import { getSignedInStatus, logout } from "@/server/items"
import { CatalogCommand } from "@/components/catalog-command"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from "@/components/ui/sidebar"

const navigation = [
  { title: "Home", to: "/", icon: HouseIcon },
  {
    title: "Books",
    to: "/books",
    icon: BookOpenIcon,
    items: [
      { title: "Reading list", to: "/books/list/$slug", slug: "reading-list" },
    ],
  },
  {
    title: "Movies",
    to: "/movies",
    icon: FilmIcon,
    items: [
      { title: "Watchlist", to: "/movies/list/$slug", slug: "watchlist" },
    ],
  },
  {
    title: "TV",
    to: "/tv",
    icon: TvIcon,
    items: [{ title: "Watchlist", to: "/tv/list/$slug", slug: "watchlist" }],
  },
] as const

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const location = useLocation()
  const router = useRouter()
  const [signedIn, setSignedIn] = useState(false)
  const [openNavigation, setOpenNavigation] = useState<Record<string, boolean>>(
    {}
  )
  const [searchOpen, setSearchOpen] = useState(false)
  useEffect(() => {
    getSignedInStatus()
      .then(setSignedIn)
      .catch(() => setSignedIn(false))
  }, [])
  useEffect(() => {
    const currentParent = navigation.find(
      (item) =>
        "items" in item &&
        item.items.some(
          (subItem) => location.pathname === `${item.to}/list/${subItem.slug}`
        )
    )
    if (currentParent && "items" in currentParent) {
      setOpenNavigation((open) => ({ ...open, [currentParent.to]: true }))
    }
  }, [location.pathname])

  async function signOut() {
    await logout()
    setSignedIn(false)
    await router.navigate({ to: "/" })
  }
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              render={<Link to="/" />}
              size="lg"
              tooltip="Shelf"
            >
              <div className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                S
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">Shelf</span>
                <span className="truncate text-xs">
                  Ryan Leichty’s collection
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => setSearchOpen(true)}
                  tooltip="Search"
                >
                  <SearchIcon />
                  <span>Search</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {navigation.map((item) => {
                if (!("items" in item)) {
                  return (
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton
                        isActive={location.pathname === item.to}
                        render={<Link to={item.to} />}
                        tooltip={item.title}
                      >
                        <item.icon />
                        <span>{item.title}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                }

                const isOnListSubpage = item.items.some(
                  (subItem) =>
                    location.pathname === `${item.to}/list/${subItem.slug}`
                )
                return (
                  <Collapsible
                    className="group/collapsible"
                    key={item.to}
                    onOpenChange={(open) =>
                      setOpenNavigation((navigation) => ({
                        ...navigation,
                        [item.to]: open,
                      }))
                    }
                    open={openNavigation[item.to] ?? isOnListSubpage}
                  >
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        isActive={location.pathname === item.to}
                        render={<Link to={item.to} />}
                        tooltip={item.title}
                      >
                        <item.icon />
                        <span>{item.title}</span>
                      </SidebarMenuButton>
                      <CollapsibleTrigger
                        render={
                          <SidebarMenuAction
                            aria-label={`Toggle ${item.title} navigation`}
                            className="rounded-full transition-transform duration-200 aria-expanded:rotate-90 data-[state=open]:rotate-90 data-open:rotate-90"
                          />
                        }
                      >
                        <ChevronRightIcon />
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          {item.items.map((subItem) => (
                            <SidebarMenuSubItem key={subItem.to}>
                              <SidebarMenuSubButton
                                isActive={
                                  location.pathname ===
                                  `${item.to}/list/${subItem.slug}`
                                }
                                render={
                                  <Link
                                    params={{ slug: subItem.slug }}
                                    to={subItem.to}
                                  />
                                }
                              >
                                <span>{subItem.title}</span>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          ))}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </SidebarMenuItem>
                  </Collapsible>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {signedIn && (
          <SidebarGroup>
            <SidebarGroupLabel>Manage</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    render={<Link to="/admin" />}
                    tooltip="Admin"
                  >
                    <BookOpenIcon />
                    <span>Admin</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          {signedIn ? (
            <>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={location.pathname === "/settings"}
                  render={<Link to="/settings" />}
                  tooltip="Settings"
                >
                  <SettingsIcon />
                  <span>Settings</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={signOut} tooltip="Log out">
                  <LogOutIcon />
                  <span>Log out</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </>
          ) : (
            <SidebarMenuItem>
              <SidebarMenuButton
                render={<Link to="/admin/login" />}
                tooltip="Log in"
              >
                <LogInIcon />
                <span>Log in</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
      <CatalogCommand onOpenChange={setSearchOpen} open={searchOpen} />
    </Sidebar>
  )
}
