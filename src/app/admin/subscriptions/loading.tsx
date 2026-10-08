import { Skeleton } from "@/components/ui/skeleton";

/** Chargement de `/admin/subscriptions` (module 10). */
export default function SubscriptionsLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-72" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-28 rounded-lg" />
        ))}
      </div>

      <div className="flex gap-2">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-9 w-44" />
        <Skeleton className="h-9 w-44" />
      </div>

      <Skeleton className="h-9 w-full max-w-md" />

      <div className="space-y-2 rounded-lg border p-4">
        <Skeleton className="h-5 w-40" />
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-9 w-full" />
        ))}
      </div>

      <Skeleton className="h-24 rounded-lg" />
    </div>
  );
}
