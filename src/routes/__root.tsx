import {
  HeadContent,
  Link,
  Scripts,
  createRootRoute,
  useRouterState,
} from "@tanstack/react-router"
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools"
import { TanStackDevtools } from "@tanstack/react-devtools"

import appCss from "../styles.css?url"
import geistLatin from "@fontsource-variable/geist/files/geist-latin-wght-normal.woff2?url"
import { AppSidebar } from "@/components/app-sidebar"
import { SignedInStatusProvider } from "@/components/signed-in-status"
import { sidebarLists } from "@/lib/catalog"
import { getShell } from "@/server/shell"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"

export const Route = createRootRoute({
  loader: () => getShell(),
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "Shelf — Ryan Leichty",
      },
    ],
    links: [
      {
        rel: "preload",
        as: "font",
        type: "font/woff2",
        crossOrigin: "anonymous",
        href: geistLatin,
      },
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  notFoundComponent: () => (
    <main className="container mx-auto max-w-6xl px-4 py-20">
      <p className="text-sm text-muted-foreground">404</p>
      <h1 className="mt-2 text-3xl font-semibold">That shelf is empty.</h1>
      <Link
        className="mt-6 inline-block text-sm underline underline-offset-4"
        to="/books"
      >
        Return to the collection
      </Link>
    </main>
  ),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  const { currentUser, signedIn, catalog } = Route.useLoaderData()
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <TooltipProvider>
          <SignedInStatusProvider
            initialSignedIn={signedIn}
            initialUser={currentUser}
          >
            <ShelfShell lists={sidebarLists(catalog)}>{children}</ShelfShell>
          </SignedInStatusProvider>
        </TooltipProvider>
        <TanStackDevtools
          config={{
            position: "bottom-right",
          }}
          plugins={[
            {
              name: "Tanstack Router",
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        />
        <Scripts />
      </body>
    </html>
  )
}

function ShelfShell({
  children,
  lists,
}: {
  children: React.ReactNode
  lists: ReturnType<typeof sidebarLists>
}) {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const isHome = pathname === "/"
  const label = pathname.startsWith("/movies")
    ? "Movies"
    : pathname.startsWith("/tv")
      ? "TV"
      : pathname.startsWith("/books")
        ? "Books"
        : pathname.startsWith("/admin/new")
          ? "Add item"
          : pathname.startsWith("/admin/login")
            ? "Log in"
            : pathname.startsWith("/admin")
              ? "Admin"
              : pathname.startsWith("/item")
                ? "Item"
                : "Home"
  return (
    <SidebarProvider className="overflow-x-hidden">
      <AppSidebar lists={lists} />
      <SidebarInset className="min-w-0 overflow-x-hidden">
        {isHome ? (
          <SidebarTrigger className="absolute top-4 left-4 z-10 bg-background/90 ring-1 ring-black/10" />
        ) : (
          <header className="z-1 flex h-16 shrink-0 items-center gap-2 px-4 shadow-[0_1px_0_--alpha(var(--color-black)/10%)]">
            <SidebarTrigger className="-ml-1" />
            <Separator className="mr-2 h-4" orientation="vertical" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink render={<Link to="/" />}>
                    Shelf
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>{label}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </header>
        )}
        {children}
      </SidebarInset>
    </SidebarProvider>
  )
}
