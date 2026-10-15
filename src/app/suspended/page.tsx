import Link from "next/link";
import { ShieldOff, PauseCircle } from "lucide-react";
import { resolveTenant } from "@/lib/tenant/resolve";
import { buttonVariants } from "@/components/ui/button";

/** `/suspended` — boutique non publique (DRAFT, SUSPENDED, ARCHIVED, PAUSED) — module 14. */
export const metadata = { title: "Boutique indisponible" };

export default async function SuspendedPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const slug = typeof sp.shop === "string" ? sp.shop : undefined;
  const status = typeof sp.status === "string" ? sp.status : undefined;
  const tenant = slug ? await resolveTenant(slug) : null;

  const isPaused = tenant?.status === "PAUSED" || status === "PAUSED";
  const isSuspended = tenant?.status === "SUSPENDED" || status === "SUSPENDED";

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-16 text-center">
      <div className="rounded-full bg-muted p-4">
        {isPaused ? (
          <PauseCircle aria-hidden className="size-6 text-amber-600" />
        ) : (
          <ShieldOff aria-hidden className="size-6 text-muted-foreground" />
        )}
      </div>

      <h1 className="mt-6 text-2xl font-semibold tracking-tight">
        {isPaused ? "Boutique momentanément fermée" : "Boutique indisponible"}
      </h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        {tenant
          ? isPaused
            ? `La boutique « ${tenant.name} » est temporairement fermée par son propriétaire.`
            : isSuspended
            ? `La boutique « ${tenant.name} » a été suspendue (impayé ou violation des conditions).`
            : `La boutique « ${tenant.name} » n'est pas accessible pour le moment (statut : ${tenant.status}).`
          : "Cette boutique n'est pas accessible pour le moment."}
      </p>
      {isPaused && (
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          Elle sera bientôt de retour. Merci de votre patience.
        </p>
      )}
      {isSuspended && (
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          Si vous en êtes responsable, connectez-vous au back-office ou contactez le support.
        </p>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Link href="/login" className={buttonVariants()}>
          Se connecter
        </Link>
        <Link
          href="/admin/dashboard"
          className={buttonVariants({ variant: "outline" })}
        >
          Back-office
        </Link>
      </div>
    </div>
  );
}
