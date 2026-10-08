import { Skeleton } from "@/components/ui/skeleton";

const ROW_KEYS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

/** Skeleton de /admin/tenants pendant le chargement de la liste. */
export default function TenantsLoading() {
  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-9 w-44" />
      </header>

      <div className="flex flex-col gap-2 lg:flex-row">
        <Skeleton className="h-9 w-full lg:max-w-sm" />
        <Skeleton className="h-9 w-full sm:w-44" />
        <Skeleton className="h-9 w-full sm:w-44" />
      </div>

      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="flex h-11 items-center gap-4 border-b px-4">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="ml-auto h-4 w-24" />
        </div>

        <div className="divide-y">
          {ROW_KEYS.map((key) => (
            <div key={key} className="flex items-center gap-4 px-4 py-3">
              <Skeleton className="h-9 w-44" />
              <Skeleton className="hidden h-4 w-40 sm:block" />
              <Skeleton className="h-5 w-20" />
              <Skeleton className="hidden h-4 w-16 md:block" />
              <Skeleton className="hidden h-4 w-24 lg:block" />
              <Skeleton className="ml-auto h-8 w-36" />
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between border-t px-4 py-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-8 w-40" />
        </div>
      </div>
    </div>
  );
}
