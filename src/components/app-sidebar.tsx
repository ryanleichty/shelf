"use client"

import { Link, useLocation, useRouter } from "@tanstack/react-router"
import {
  BookOpenIcon,
  ChevronsUpDownIcon,
  ChevronRightIcon,
  FilmIcon,
  HeartIcon,
  HouseIcon,
  LogInIcon,
  LogOutIcon,
  ScanLineIcon,
  SearchIcon,
  SettingsIcon,
  TvIcon,
} from "lucide-react"
import { lazy, Suspense, useEffect, useState } from "react"
import { useSignedInStatus } from "@/components/signed-in-status"
import { logout } from "@/server/session"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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

const CatalogCommand = lazy(() => import("@/components/catalog-command"))

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

export function AppSidebar({
  lists,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  lists: Array<{ slug: string; name: string; type: "book" | "movie" | "tv" }>
}) {
  const location = useLocation()
  const router = useRouter()
  const { currentUser, signedIn, setCurrentUser, setSignedIn } =
    useSignedInStatus()
  const [openNavigation, setOpenNavigation] = useState<Record<string, boolean>>(
    {}
  )
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchMounted, setSearchMounted] = useState(false)
  useEffect(() => {
    if (searchOpen) setSearchMounted(true)
  }, [searchOpen])
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        setSearchOpen(true)
      }
    }
    document.addEventListener("keydown", keydown)
    return () => document.removeEventListener("keydown", keydown)
  }, [])
  useEffect(() => {
    const currentParent = catalogNavigation.find(
      (item) =>
        location.pathname === `${item.to}/all` ||
        lists
          .filter((placement) => placement.type === item.type)
          .some(
            (placement) =>
              location.pathname === `${item.to}/list/${placement.slug}`
          )
    )
    if (currentParent) {
      setOpenNavigation((open) => ({ ...open, [currentParent.to]: true }))
    }
  }, [location.pathname, lists])

  async function signOut() {
    await logout()
    await router.invalidate()
    setCurrentUser(null)
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
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={location.pathname === "/wishlist"}
                    render={<Link to="/wishlist" />}
                    tooltip="Wishlist"
                  >
                    <HeartIcon />
                    <span>Wishlist</span>
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
                    ...lists
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
          {signedIn && currentUser ? (
            <SidebarMenu>
              <SidebarMenuItem>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <SidebarMenuButton
                        size="lg"
                        tooltip={`${currentUser.firstName} ${currentUser.lastName}`}
                      />
                    }
                  >
                    <Avatar>
                      {currentUser.avatarUrl && (
                        <AvatarImage
                          alt={`${currentUser.firstName} ${currentUser.lastName}`}
                          src={currentUser.avatarUrl}
                        />
                      )}
                      <AvatarFallback>
                        {currentUser.firstName.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-medium">
                        {currentUser.firstName} {currentUser.lastName}
                      </span>
                    </div>
                    <ChevronsUpDownIcon className="ml-auto" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" side="top">
                    <DropdownMenuGroup>
                      <DropdownMenuItem render={<Link to="/settings" />}>
                        <SettingsIcon /> Settings
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={signOut}>
                        <LogOutIcon /> Log out
                      </DropdownMenuItem>
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              </SidebarMenuItem>
            </SidebarMenu>
          ) : (
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
          )}
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      {searchMounted && (
        <Suspense fallback={null}>
          <CatalogCommand onOpenChange={setSearchOpen} open={searchOpen} />
        </Suspense>
      )}
    </>
  )
}
