import { cn } from "@/lib/utils";

/**
 * Bloc de chargement (skeleton) réutilisable avec <Suspense>.
 */
export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  );
}
