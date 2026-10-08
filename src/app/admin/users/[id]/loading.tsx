import { Skeleton } from "@/components/ui/skeleton";

/** Chargement de `/admin/users/[id]` (module 9). */
export default function UserDetailLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-8 w-72" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-3 rounded-lg border bg-card p-5">
          <Skeleton className="h-5 w-24" />
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-9 w-full" />
          ))}
        </div>
        <div className="space-y-3 rounded-lg border bg-card p-5 lg:col-span-2">
          <Skeleton className="h-5 w-48" />
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-12 w-full" />
          ))}
        </div>
      </div>

      <div className="space-y-3 rounded-lg border bg-card p-5">
        <Skeleton className="h-5 w-48" />
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-9 w-full" />
        ))}
      </div>
    </div>
  );
}
