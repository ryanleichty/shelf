import { Skeleton } from "@/components/ui/skeleton"

export function PendingShelf() {
  return (
    <main className="container mx-auto max-w-6xl px-4 py-10" aria-busy="true">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="mt-3 h-9 w-64" />
      <div className="mt-10 grid grid-cols-3 gap-4 sm:grid-cols-4 lg:grid-cols-6">
        {Array.from({ length: 12 }, (_, index) => (
          <Skeleton className="aspect-2/3 rounded-lg" key={index} />
        ))}
      </div>
    </main>
  )
}
