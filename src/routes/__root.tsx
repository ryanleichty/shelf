import { HeadContent, Link, Scripts, createRootRoute } from "@tanstack/react-router"
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools"
import { TanStackDevtools } from "@tanstack/react-devtools"

import appCss from "../styles.css?url"

export const Route = createRootRoute({
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
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  notFoundComponent: () => (
    <main className="container mx-auto max-w-6xl px-4 py-20">
      <p className="text-sm text-muted-foreground">404</p>
      <h1 className="mt-2 text-3xl font-semibold">That shelf is empty.</h1>
      <Link className="mt-6 inline-block text-sm underline underline-offset-4" to="/">Return to the collection</Link>
    </main>
  ),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <header className="border-b">
          <div className="container mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link className="text-lg font-semibold tracking-tight" to="/">Shelf</Link>
          <nav className="flex items-center gap-1" aria-label="Primary navigation">
            <Link activeProps={{ className: "bg-accent text-accent-foreground" }} className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground" to="/books">Books</Link>
            <Link activeProps={{ className: "bg-accent text-accent-foreground" }} className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground" to="/movies">Movies</Link>
          </nav>
          </div>
        </header>
        {children}
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
