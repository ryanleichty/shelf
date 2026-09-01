"use client"

import { Link, useLocation, useRouter } from "@tanstack/react-router"
import {
  BookOpenIcon,
  ChevronRightIcon,
  FilmIcon,
  HouseIcon,
  LogInIcon,
  LogOutIcon,
  ScanLineIcon,
  SearchIcon,
  SettingsIcon,
  TvIcon,
} from "lucide-react"
import { useEffect, useState } from "react"
import { useSignedInStatus } from "@/components/signed-in-status"
import { logout } from "@/server/items"
import { getSidebarLists } from "@/server/lists"
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

const catalogNavigation = [
  {
    title: "Books",
    to: "/books",
    icon: BookOpenIcon,
    type: "book",
  },
  {
    title: "Movies",
    to: "/movies",
    icon: FilmIcon,
    type: "movie",
  },
  {
    title: "TV",
    to: "/tv",
    icon: TvIcon,
    type: "tv",
  },
] as const

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const location = useLocation()
  const router = useRouter()
  const { signedIn, setSignedIn } = useSignedInStatus()
  const [listPlacements, setListPlacements] = useState<
    Array<{ slug: string; name: string; type: "book" | "movie" | "tv" }>
  >([])
  const [openNavigation, setOpenNavigation] = useState<Record<string, boolean>>(
    {}
  )
  const [searchOpen, setSearchOpen] = useState(false)
  useEffect(() => {
    getSidebarLists()
      .then((placements) =>
        setListPlacements(
          placements.flatMap((placement) =>
            placement.slug && placement.name
              ? [
                  {
                    slug: placement.slug,
                    name: placement.name,
                    type: placement.type,
                  },
                ]
              : []
          )
        )
      )
      .catch(() => setListPlacements([]))
  }, [])
  useEffect(() => {
    const currentParent = catalogNavigation.find(
      (item) =>
        location.pathname === `${item.to}/all` ||
        listPlacements
          .filter((placement) => placement.type === item.type)
          .some(
            (placement) =>
              location.pathname === `${item.to}/list/${placement.slug}`
          )
    )
    if (currentParent) {
      setOpenNavigation((open) => ({ ...open, [currentParent.to]: true }))
    }
  }, [location.pathname, listPlacements])

  async function signOut() {
    await logout()
    setSignedIn(false)
    await router.navigate({ to: "/" })
  }

  return (
    <>
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
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={location.pathname === "/"}
                    render={<Link to="/" />}
                    tooltip="Home"
                  >
                    <HouseIcon />
                    <span>Home</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          <SidebarGroup>
            <SidebarGroupLabel>Catalog</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {catalogNavigation.map((item) => {
                  const subItems = [
                    { title: "All", to: `${item.to}/all` },
                    ...listPlacements
                      .filter((placement) => placement.type === item.type)
                      .map((placement) => ({
                        title: placement.name,
                        to: `${item.to}/list/${placement.slug}`,
                      })),
                  ]
                  const isOnSubpage = subItems.some(
                    (subItem) => location.pathname === subItem.to
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
                      open={openNavigation[item.to] ?? isOnSubpage}
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
                              className="rounded-full transition-transform duration-200 data-panel-open:rotate-90"
                            />
                          }
                        >
                          <ChevronRightIcon />
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <SidebarMenuSub>
                            {subItems.map((subItem) => {
                              const path = subItem.to
                              return (
                                <SidebarMenuSubItem key={path}>
                                  <SidebarMenuSubButton
                                    isActive={location.pathname === path}
                                    render={<Link to={path} />}
                                  >
                                    <span>{subItem.title}</span>
                                  </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                              )
                            })}
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
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      render={<Link to="/check" />}
                      tooltip="Scan barcode"
                    >
                      <ScanLineIcon />
                      <span>Scan barcode</span>
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
      </Sidebar>
      <CatalogCommand onOpenChange={setSearchOpen} open={searchOpen} />
    </>
  )
}
